import type { Tx } from './types';
import { lockLibraryItem } from './transaction';
import { recoverAttempt } from './recover-attempt';
import { stopOperation } from './stop-internal';
export async function recoverExpired(tx: Tx, now: Date) {
  const expired = await tx.pdfJobAttempt.findMany({
    where: {
      status: 'RUNNING',
      OR: [
        { leaseExpiresAt: { lte: now } },
        { deadlineAt: { lte: now } },
        { principal: { revokedAt: { not: null } } },
      ],
    },
    include: { job: { include: { operation: true } }, principal: true },
    orderBy: { id: 'asc' },
    take: 100,
  });
  for (const initial of expired) {
    await lockLibraryItem(tx, initial.job.operation.libraryItemId);
    const attempt = await tx.pdfJobAttempt.findUnique({
      where: { id: initial.id },
      include: { job: { include: { operation: true } }, principal: true },
    });
    if (!attempt || attempt.status !== 'RUNNING') continue;
    const op = attempt.job.operation;
    if (
      op.deletedAt ||
      attempt.principal.revokedAt ||
      !(await tx.libraryItem.findFirst({
        where: { id: op.libraryItemId, userId: op.ownerId },
      }))
    ) {
      await stopOperation(tx, op, now, 'EXECUTION_REVOKED');
      continue;
    }
    await recoverAttempt(tx, attempt, now, 'LEASE_EXPIRED');
  }
}
