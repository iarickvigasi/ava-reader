import type { PrismaService } from '../../prisma/prisma.service';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { requireEpubClaim, type EpubClaim } from './claim-authority';
import { InvalidImportedEpub } from './import-output';
export async function failEpubAttempt(
  prisma: PrismaService,
  claim: EpubClaim,
  error: unknown,
) {
  await jobTransaction(prisma, async (tx) => {
    const { run, now } = await requireEpubClaim(tx, claim);
    const terminal =
      error instanceof InvalidImportedEpub ||
      run.attemptCount >= 3 ||
      !run.activeDeadlineAt ||
      run.activeDeadlineAt <= now;
    await tx.bookProcessingRun.update({
      where: { id: run.id },
      data: {
        status: terminal ? 'FAILED' : 'PENDING',
        completedAt: terminal ? now : null,
        errorMessage: terminal ? 'The EPUB could not be prepared.' : null,
        leaseExpiresAt: null,
        leaseTokenHash: null,
      },
    });
  }).catch(() => {});
}
