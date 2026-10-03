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
import { activateCanonicalEpub } from './activate';
import { failEpubAttempt } from './fail-attempt';
export async function processCanonicalEpubOnce(
  prisma: PrismaService,
  config?: PdfRuntimeConfig,
  semantic: SemanticValidator = readerSemanticValidator,
) {
  if (await activateCanonicalEpub(prisma, semantic).catch(() => false))
    return true;
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
    });
    staged = await stagePreparedEpub(prisma, prepared);
    await retainPreparedEpub(
      prisma,
      claim,
      prepared,
      staged,
      runtime!.image.slice(7),
    );
    staged = undefined;
    await activateCanonicalEpub(prisma, semantic).catch(() => false);
  } catch (error) {
    await failEpubAttempt(prisma, claim, error);
  } finally {
    await guard.dispose();
    for (const id of staged?.blobIds ?? [])
      await prisma.storedBlob.delete({ where: { id } }).catch(() => {});
  }
  return true;
}
