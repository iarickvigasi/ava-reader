import { workerObservationSink } from './worker-observation-sink';
import { requireAttempt } from '../../library/pdf-import/jobs/authority';
import { tryQueueLock } from '../../library/pdf-import/jobs/transaction';
import { tryCostLock } from '../../library/pdf-import/providers/cost-lock';
import { recordOperationEvent } from '../../library/pdf-import/reports/operation-event';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { Tx } from '../../library/pdf-import/jobs/types';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import type { SafeConversionEvent } from '../../library/pdf-import/reports/event-contract';

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

const event: SafeConversionEvent = {
  kind: 'STAGE_ENDED',
  stage: 'ASSEMBLY',
  severity: 'INFO',
  details: { unitId: 'unit-fixture', outcome: 'COMPLETED' },
};
function setup() {
  const claim = {
    jobId: 'job-fixture',
    job: JSON.parse(fixtureBytes('ava-pdf-job-1').toString()) as JobInputV1,
    authority: {
      principalId: 'worker-fixture',
      token: 'secret',
      attemptId: 'attempt-fixture',
      attemptToken: 'secret',
    },
  } as ClaimedPdfJob;
  const scope = {
    job: structuredClone(claim.job),
    attempt: { jobId: claim.jobId },
  } as Awaited<ReturnType<typeof requireAttempt>>;
  const transaction = jest.fn((work: (tx: Tx) => Promise<unknown>) =>
    work({} as Tx),
  );
  jest.mocked(requireAttempt).mockResolvedValue(scope);
  return {
    claim,
    scope,
    transaction,
    sink: workerObservationSink(
      { $transaction: transaction } as unknown as PrismaService,
      claim,
    ),
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(tryQueueLock).mockResolvedValue(true);
  jest.mocked(tryCostLock).mockResolvedValue(true);
});
function delivered(claim: ClaimedPdfJob): SafeConversionEvent {
  return {
    ...event,
    attemptId: claim.authority.attemptId,
    attemptFence: claim.job.attempt_fence,
    generation: claim.job.generation,
    cancellationEpoch: claim.job.cancellation_epoch,
    details: {
      ...event.details,
      jobId: claim.jobId,
      sourceSha256: claim.job.source.sha256,
      configSha256: claim.job.config_sha256,
      profileId: claim.job.profile_id,
      workerFingerprint: claim.job.worker_fingerprint,
      observationDelivery: {
        producerId: claim.authority.attemptId,
        ordinal: 1,
      },
    },
  };
}
it('an immutable ordinal retains identical journal keys and payloads when delivered again', async () => {
  const { sink, claim } = setup();
  const value = delivered(claim);
  sink.emit(value);
  sink.emit(structuredClone(value));
  await sink.whenSettled();
  expect(jest.mocked(recordOperationEvent).mock.calls[0]).toEqual(
    jest.mocked(recordOperationEvent).mock.calls[1],
  );
});
it('rejects a producer envelope that disagrees with its immutable attempt binding', async () => {
  const { sink, claim } = setup();
  const value = delivered(claim);
  value.details.sourceSha256 = 'd'.repeat(64);
  sink.emit(value);
  await sink.whenSettled();
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary().lost).toBe(1);
});
it('identical producer units retain identical journal keys/payloads instead of dynamic queue-state conflicts', async () => {
  const { sink, transaction } = setup();
  sink.emit(event);
  sink.emit(event);
  await sink.whenSettled();
  expect(jest.mocked(recordOperationEvent).mock.calls[0]).toEqual(
    jest.mocked(recordOperationEvent).mock.calls[1],
  );
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
    maxWait: 100,
    timeout: 750,
  });
  expect(requireAttempt).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ attemptId: 'attempt-fixture' }),
    true,
  );
  expect(sink.summary()).toEqual({ pending: 0, lost: 0, state: 'RECORDED' });
});
it('busy optional locks skip capture without touching authority, ledger or conversion outcome', async () => {
  const { sink } = setup();
  jest.mocked(tryQueueLock).mockResolvedValue(false);
  sink.emit(event);
  await sink.whenSettled();
  expect(tryCostLock).not.toHaveBeenCalled();
  expect(requireAttempt).not.toHaveBeenCalled();
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary()).toEqual({ pending: 0, lost: 1, state: 'PARTIAL' });
});
it('late stale generation and lost authority are rejected without a historical write', async () => {
  const { sink, scope } = setup();
  scope.job.generation++;
  sink.emit(event);
  await sink.whenSettled();
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary().lost).toBe(1);
});
it('caller mutation cannot change captured job or attempt identity while queued', async () => {
  const { sink, claim } = setup();
  sink.emit(event);
  claim.jobId = 'different-job';
  claim.authority.attemptId = 'different-attempt';
  claim.job.generation++;
  await sink.whenSettled();
  expect(recordOperationEvent).toHaveBeenCalledTimes(1);
  expect(requireAttempt).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ attemptId: 'attempt-fixture' }),
    true,
  );
});
it('bounds outstanding optional events and exposes dropped capture while conversion code stays synchronous', async () => {
  const { sink } = setup();
  for (let n = 0; n < 20; n++)
    sink.emit({ ...event, details: { ...event.details, unitId: `unit-${n}` } });
  expect(sink.summary()).toEqual({ pending: 16, lost: 4, state: 'PARTIAL' });
  await sink.whenSettled();
  expect(recordOperationEvent).toHaveBeenCalledTimes(16);
  expect(sink.summary()).toEqual({ pending: 0, lost: 4, state: 'PARTIAL' });
});
it('sink failures retain an explicit partial disposition rather than rejecting a work promise', async () => {
  const { sink } = setup();
  jest.mocked(requireAttempt).mockRejectedValue(new Error('lost lease'));
  sink.emit(event);
  await expect(sink.whenSettled()).resolves.toBeUndefined();
  expect(recordOperationEvent).not.toHaveBeenCalled();
  expect(sink.summary().state).toBe('PARTIAL');
});
