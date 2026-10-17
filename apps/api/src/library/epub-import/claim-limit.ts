import type { BookProcessingRun } from '@prisma/client';
import type { Tx } from '../pdf-import/jobs/types';
export async function markEpubClaimLimit(
  tx: Tx,
  run: BookProcessingRun,
  now: Date,
  hasOwner: boolean,
) {
  await tx.bookProcessingRun.update({
    where: { id: run.id },
    data: {
      status: 'FAILED',
      completedAt: now,
      errorMessage: 'The EPUB could not be prepared.',
      leaseExpiresAt: null,
      leaseTokenHash: null,
    },
  });
  return {
    runId: run.id,
    fence: run.attemptFence,
    code: !hasOwner
      ? 'IMPORT_OWNER_UNAVAILABLE'
      : run.attemptCount >= 3
        ? 'ATTEMPTS_EXHAUSTED'
        : 'ACTIVE_DEADLINE_EXPIRED',
  };
}
