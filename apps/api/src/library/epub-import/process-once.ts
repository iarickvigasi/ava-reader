import type { PrismaService } from '../../prisma/prisma.service';
import {
  runtimeConfigFromEnvironment,
  validateRuntimeConfig,
  type PdfRuntimeConfig,
} from '../../pdf-conversion/runtime/runtime-config';
import { readerSemanticValidator } from '../../reader/canonical/semantic';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { claimCanonicalEpub } from './claim';
import { requireEpubClaim } from './claim-authority';
import { epubLease } from './lease';
import { prepareCanonicalEpub } from './prepare-import';
import { stagePreparedEpub } from './stage-prepared';
import { retainPreparedEpub } from './retain-prepared';
import { tryActivateCanonicalEpub } from './try-activate';
import { epubPhases } from './phase';
import { recordEpubClaim } from './claim-diagnostics';
import { settleEpubFailure } from './settle-failure';
export async function processCanonicalEpubOnce(
  prisma: PrismaService,
  config?: PdfRuntimeConfig,
  semantic: SemanticValidator = readerSemanticValidator,
) {
  if (await tryActivateCanonicalEpub(prisma, semantic)) return true;
  const claimStarted = performance.now();
  let runtime: PdfRuntimeConfig | undefined;
  const claim = await claimCanonicalEpub(prisma, () => {
    runtime = config
      ? validateRuntimeConfig(config)
      : runtimeConfigFromEnvironment();
  });
  if (!claim) return false;
  const guard = epubLease(
    prisma,
    claim,
    claim.leaseRemainingMs - (performance.now() - claimStarted),
  );
  const phase = epubPhases(prisma, claim.runId, claim.fence);
  await recordEpubClaim(prisma, claim);
  let staged: Awaited<ReturnType<typeof stagePreparedEpub>> | undefined;
  try {
    const { run } = await jobTransaction(prisma, (tx) =>
      requireEpubClaim(tx, claim),
    );
    const source = await prisma.bookFile.findUniqueOrThrow({
      where: { id: run.sourceFileId! },
      include: { blob: true },
    });
    await guard.confirm();
    const prepared = await prepareCanonicalEpub({
      bytes: Buffer.from(source.blob.bytes),
      finalContentId: run.canonicalContentId!,
      runtime: runtime!,
      semantic,
      signal: guard.signal,
      remainingMs: guard.remainingMs,
      phase,
    });
    staged = await phase('EPUB_ARTIFACT_STORAGE', () =>
      stagePreparedEpub(prisma, prepared),
    );
    await phase('EPUB_PREPARED_STORAGE', () =>
      retainPreparedEpub(
        prisma,
        claim,
        prepared,
        staged!,
        runtime!.image.slice(7),
      ),
    );
    staged = undefined;
    await tryActivateCanonicalEpub(prisma, semantic);
  } catch (error) {
    const classified: unknown = guard.signal.reason ?? error;
    await settleEpubFailure(prisma, claim, classified);
  } finally {
    await guard.dispose();
    for (const id of staged?.blobIds ?? [])
      await prisma.storedBlob.delete({ where: { id } }).catch(() => {});
  }
  return true;
}
