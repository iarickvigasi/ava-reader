import type { PrismaService } from '../../prisma/prisma.service';
import { jobTransaction } from '../pdf-import/jobs/transaction';
import { requireEpubClaim, type EpubClaim } from './claim-authority';
import { permanentEpubFailure } from './failure-code';
export async function failEpubAttempt(
  prisma: PrismaService,
  claim: EpubClaim,
  error: unknown,
) {
  return jobTransaction(prisma, async (tx) => {
    const { run, now } = await requireEpubClaim(tx, claim);
    const terminal =
      permanentEpubFailure(error) ||
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
    return terminal ? 'FAILED' : 'PENDING';
  }).catch((error) =>
    error instanceof Error && error.message === 'EPUB_IMPORT_AUTHORITY_INVALID'
      ? 'AUTHORITY_LOST'
      : 'SETTLEMENT_UNAVAILABLE',
  );
}
