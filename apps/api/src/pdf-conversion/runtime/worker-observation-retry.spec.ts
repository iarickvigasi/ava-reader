import { Logger } from '@nestjs/common';
import { workerObservationSink } from './worker-observation-sink';
import { requireAttempt } from '../../library/pdf-import/jobs/authority';
import { JobAuthorityError } from '../../library/pdf-import/jobs/errors';
import { tryQueueLock } from '../../library/pdf-import/jobs/transaction';
import { tryCostLock } from '../../library/pdf-import/providers/cost-lock';
import { recordOperationEvent } from '../../library/pdf-import/reports/operation-event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { Tx } from '../../library/pdf-import/jobs/types';
import type { SafeConversionEvent } from '../../library/pdf-import/reports/event-contract';
import { fixtureBytes } from '../contracts/contract-fixtures';
jest.mock('../../library/pdf-import/jobs/authority', () => ({
  requireAttempt: jest.fn(),
}));
jest.mock('../../library/pdf-import/jobs/transaction', () => ({
  tryQueueLock: jest.fn(),
}));
jest.mock('../../library/pdf-import/providers/cost-lock', () => ({
  tryCostLock: jest.fn(),
}));
jest.mock('../../library/pdf-import/reports/operation-event', () => ({
  recordOperationEvent: jest.fn(),
}));
function setup(signal?: AbortSignal) {
  const job = JSON.parse(
    fixtureBytes('ava-pdf-job-1').toString(),
  ) as ClaimedPdfJob['job'];
  const claim = {
    jobId: 'job-fixture',
    job,
    authority: {
      principalId: 'worker-fixture',
      token: 'secret',
      attemptId: 'attempt-fixture',
      attemptToken: 'secret',
    },
  } as ClaimedPdfJob;
  const transaction = jest.fn((work: (tx: Tx) => Promise<unknown>) =>
    work({} as Tx),
  );
  jest
    .mocked(requireAttempt)
    .mockResolvedValue({ job, attempt: { jobId: claim.jobId } } as Awaited<
      ReturnType<typeof requireAttempt>
    >);
  const event: SafeConversionEvent = {
    kind: 'STAGE_ENDED',
    stage: 'STAGING',
    severity: 'INFO',
    attemptId: claim.authority.attemptId,
    attemptFence: job.attempt_fence,
    generation: job.generation,
    cancellationEpoch: job.cancellation_epoch,
    details: {
      unitId: 'unit-1',
      outcome: 'COMPLETED',
      jobId: claim.jobId,
      sourceSha256: job.source.sha256,
      configSha256: job.config_sha256,
      profileId: job.profile_id,
      workerFingerprint: job.worker_fingerprint,
      observationDelivery: {
        producerId: claim.authority.attemptId,
        ordinal: 1,
      },
    },
  };
  return {
    transaction,
    event,
    claim,
    sink: workerObservationSink(
      { $transaction: transaction } as unknown as PrismaService,
      claim,
      signal,
    ),
  };
}
let warning: jest.SpyInstance;
beforeEach(() => {
  jest.resetAllMocks();
  warning = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  jest.mocked(tryQueueLock).mockResolvedValue(true);
  jest.mocked(tryCostLock).mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());
it('retains an immutable event when a busy conversion lock clears on the next fresh transaction', async () => {
  const { sink, event, transaction } = setup();
  jest.mocked(tryQueueLock).mockResolvedValueOnce(false);
  sink.emit(event);
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(2);
  expect(requireAttempt).toHaveBeenCalledTimes(1);
  expect(recordOperationEvent).toHaveBeenCalledTimes(1);
  expect(sink.summary()).toEqual({ pending: 0, lost: 0, state: 'RECORDED' });
});
it('bounds a permanently busy lock to three attempts and one classified loss', async () => {
  const { sink, event, transaction } = setup();
  jest.mocked(tryCostLock).mockResolvedValue(false);
  sink.emit(event);
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(3);
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary().lost).toBe(1);
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'LOCK_BUSY',
    }),
  );
});
it('does not retry revoked authority or leak its failure text', async () => {
  const { sink, event, transaction } = setup();
  jest.mocked(requireAttempt).mockRejectedValue(new JobAuthorityError());
  sink.emit(event);
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'AUTHORITY',
    }),
  );
});
it('never retries an unknown transaction outcome, even after its callback appended', async () => {
  const { sink, event, transaction } = setup();
  transaction.mockImplementationOnce(async (work) => {
    await work({} as Tx);
    throw new Error('private db/token failure');
  });
  sink.emit(event);
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(recordOperationEvent).toHaveBeenCalledTimes(1);
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'TRANSACTION',
    }),
  );
});
it('reuses the same ordinal key and payload after contention and duplicate delivery', async () => {
  const { sink, event } = setup();
  jest.mocked(tryQueueLock).mockResolvedValueOnce(false);
  sink.emit(event);
  sink.emit(structuredClone(event));
  await sink.whenSettled();
  expect(recordOperationEvent).toHaveBeenCalledTimes(2);
  expect(jest.mocked(recordOperationEvent).mock.calls[0]).toEqual(
    jest.mocked(recordOperationEvent).mock.calls[1],
  );
});

it('rechecks authority after busy backoff and stops when the retry observes revocation', async () => {
  const { sink, event, transaction } = setup();
  jest.mocked(tryQueueLock).mockResolvedValueOnce(false);
  jest.mocked(requireAttempt).mockRejectedValue(new JobAuthorityError());
  sink.emit(event);
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(2);
  expect(requireAttempt).toHaveBeenCalledTimes(1);
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'AUTHORITY',
    }),
  );
});
it('does not retry invalid schema or binding or print rejected values', async () => {
  const { sink, event, transaction } = setup();
  sink.emit({
    ...event,
    details: { ...event.details, sourceSha256: 'private source/token' },
  });
  sink.emit({
    ...event,
    details: { ...event.details, sourceSha256: 'd'.repeat(64) },
  });
  await sink.whenSettled();
  expect(transaction).not.toHaveBeenCalled();
  expect(sink.summary().lost).toBe(2);
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'SCHEMA',
    }),
  );
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'BINDING',
    }),
  );
});

it('aborts busy backoff without starting another transaction', async () => {
  const controller = new AbortController();
  const { sink, event, transaction } = setup(controller.signal);
  jest.mocked(tryQueueLock).mockResolvedValue(false);
  sink.emit(event);
  for (let n = 0; n < 12; n++) await Promise.resolve();
  expect(transaction).toHaveBeenCalledTimes(1);
  controller.abort();
  await sink.whenSettled();
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary().lost).toBe(1);
  expect(warning).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
      reason: 'ABORTED',
    }),
  );
});

it('correlates safe loss warnings to immutable admitted claim identities', async () => {
  const { sink, event, claim } = setup();
  const operationId = claim.job.operation_id,
    attemptId = claim.authority.attemptId;
  jest.mocked(tryQueueLock).mockResolvedValue(false);
  sink.emit(event);
  claim.job.operation_id = 'operation-mutated';
  claim.authority.attemptId = 'attempt-mutated';
  await sink.whenSettled();
  expect(warning).toHaveBeenCalledWith({
    code: 'PDF_WORKER_OBSERVATION_NOT_RECORDED',
    reason: 'LOCK_BUSY',
    operationId,
    attemptId,
  });
  expect(JSON.stringify(warning.mock.calls)).not.toContain('secret');
});
