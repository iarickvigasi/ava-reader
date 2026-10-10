import type { Tx } from './types';
import { lockLibraryItem } from './transaction';
import { terminalFailure } from './terminal-failure';
import { stopOperation } from './stop-internal';

const EXECUTION_WAITS = [
  'EXECUTION_AUTHORITY',
  'INTERNAL_BUDGET',
  'PROVIDER_RECONCILIATION',
];

// Provider/configuration waits consume the captured execution deadline; review waits do not.
export async function recoverExpiredWaits(tx: Tx, now: Date) {
  const jobs = await tx.pdfConversionJob.findMany({
    where: {
      state: 'WAITING',
      waitReason: { in: EXECUTION_WAITS },
      deadlineAt: { lte: now },
      operation: { status: 'WAITING', deletedAt: null, finalContentId: null },
    },
    include: { operation: true },
    orderBy: { id: 'asc' },
    take: 100,
  });
  for (const initial of jobs) {
    await lockLibraryItem(tx, initial.operation.libraryItemId);
    const job = await tx.pdfConversionJob.findUnique({
      where: { id: initial.id },
      include: { operation: true },
    });
    if (
      !job ||
      job.state !== 'WAITING' ||
      !EXECUTION_WAITS.includes(job.waitReason ?? '') ||
      !job.deadlineAt ||
      job.deadlineAt > now ||
      job.operation.status !== 'WAITING' ||
      job.operation.finalContentId
    )
      continue;
    const op = job.operation;
    if (
      op.deletedAt ||
      !(await tx.libraryItem.findFirst({
        where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
      }))
    ) {
      await stopOperation(tx, op, now, 'EXECUTION_REVOKED');
      continue;
    }
    // Its finished attempt already records why execution paused. Keep that diagnosis unchanged.
    await terminalFailure(tx, {
      job,
      operation: op,
      code: 'EXECUTION_TIMEOUT',
      now,
    });
  }
}
