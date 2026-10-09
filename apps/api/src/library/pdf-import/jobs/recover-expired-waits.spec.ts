import { recoverExpiredWaits } from './recover-expired-waits';
import type { Tx } from './types';

jest.mock('./transaction', () => ({ lockLibraryItem: jest.fn() }));
jest.mock('../providers/cost-lock', () => ({ costLock: jest.fn() }));
jest.mock('../reports/operation-event', () => ({
  recordOperationEvent: jest.fn(),
}));
const partial = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value);
const now = new Date('2026-10-06T16:33:00Z');
function fixture() {
  const op = {
    id: 'operation',
    ownerId: 'owner',
    libraryItemId: 'item',
    bookId: 'book',
    status: 'WAITING',
    finalContentId: null,
    deletedAt: null,
    stage: 'RECONSTRUCTION',
    sourceSha256: 'a'.repeat(64),
    configSha256: 'b'.repeat(64),
    generation: 1,
    cancellationEpoch: 0,
  };
  const job = {
    id: 'job',
    operation: op,
    state: 'WAITING',
    waitReason: 'EXECUTION_AUTHORITY',
    deadlineAt: new Date(now.getTime() - 1),
    attemptFence: 1,
  };
  const tx = {
    pdfConversionJob: {
      findMany: jest.fn().mockResolvedValue([job]),
      findUnique: jest.fn().mockResolvedValue(job),
      update: jest.fn(),
    },
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    pdfJobFailure: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'failure', safeReason: 'Timeout' }),
    },
    pdfNotificationIntent: { create: jest.fn() },
    pdfImportOperation: { update: jest.fn() },
    pdfJobAttempt: { update: jest.fn() },
  };
  return { tx, job, op };
}

it('expires a bounded execution wait with failure/investigation/notification and preserves its old attempt', async () => {
  const { tx } = fixture();
  await recoverExpiredWaits(tx as unknown as Tx, now);
  expect(tx.pdfConversionJob.findMany).toHaveBeenCalledWith(
    partial({
      where: partial({
        deadlineAt: { lte: now },
        waitReason: {
          in: [
            'EXECUTION_AUTHORITY',
            'INTERNAL_BUDGET',
            'PROVIDER_RECONCILIATION',
          ],
        },
      }),
      take: 100,
    }),
  );
  expect(tx.pdfJobFailure.create).toHaveBeenCalledWith(
    partial({
      data: partial({
        code: 'EXECUTION_TIMEOUT',
        stage: 'RECONSTRUCTION',
      }),
    }),
  );
  expect(tx.pdfImportOperation.update).toHaveBeenCalledWith(
    partial({
      data: partial({
        status: 'FAILED',
        investigationMarkedAt: now,
        notificationPendingAt: now,
      }),
    }),
  );
  expect(tx.pdfNotificationIntent.create).toHaveBeenCalledTimes(1);
  expect(tx.pdfJobAttempt.update).not.toHaveBeenCalled();
});

it.each(['INTERNAL_BUDGET', 'PROVIDER_RECONCILIATION'])(
  'expires %s without touching money ledgers',
  async (reason) => {
    const { tx, job } = fixture();
    job.waitReason = reason;
    await recoverExpiredWaits(tx as unknown as Tx, now);
    expect(tx.pdfJobFailure.create).toHaveBeenCalledTimes(1);
  },
);

it.each(['REVIEW', 'READER'])(
  'leaves %s waiting outside the execution deadline sweep',
  async (reason) => {
    const { tx, job } = fixture();
    job.waitReason = reason;
    await recoverExpiredWaits(tx as unknown as Tx, now);
    expect(tx.pdfJobFailure.create).not.toHaveBeenCalled();
  },
);

it('rechecks a wait resumed or already failed after selection instead of failing it again', async () => {
  for (const state of ['QUEUED', 'FAILED']) {
    const { tx, job } = fixture();
    job.state = state;
    await recoverExpiredWaits(tx as unknown as Tx, now);
    expect(tx.pdfJobFailure.create).not.toHaveBeenCalled();
  }
});

it('does not shorten a live original deadline or fail published content', async () => {
  const { tx, job, op } = fixture();
  job.deadlineAt = new Date(now.getTime() + 1);
  await recoverExpiredWaits(tx as unknown as Tx, now);
  expect(tx.pdfJobFailure.create).not.toHaveBeenCalled();
  job.deadlineAt = new Date(now.getTime() - 1);
  (op as { finalContentId: string | null }).finalContentId = 'accepted';
  await recoverExpiredWaits(tx as unknown as Tx, now);
  expect(tx.pdfJobFailure.create).not.toHaveBeenCalled();
});
