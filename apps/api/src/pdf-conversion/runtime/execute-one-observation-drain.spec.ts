import { executeOne } from './execute-one';
import { claimPdfJob } from '../../library/pdf-import/jobs';
import { runClaimedContent } from './run-claimed-content';
import { completeStagedPdfJob } from '../../library/pdf-import/jobs/complete-staged';
import { settleExecutionFailure } from './settle-execution-failure';
import { workerObservationSink } from './worker-observation-sink';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import { testConfig } from './config-fixture';
import { fixtureBytes } from '../contracts/contract-fixtures';
import { PdfRuntimeError } from './runtime-error';
let controller: AbortController;
const guard = {
  get signal() {
    return controller.signal;
  },
  remainingMs: () => 30000,
  diagnostic: () => ({}),
  dispose: jest.fn(),
};
jest.mock('../../library/pdf-import/jobs', () => ({
  ...jest.requireActual<typeof import('../../library/pdf-import/jobs')>(
    '../../library/pdf-import/jobs',
  ),
  claimPdfJob: jest.fn(),
}));
jest.mock('./run-claimed-content', () => ({ runClaimedContent: jest.fn() }));
jest.mock('../../library/pdf-import/jobs/complete-staged', () => ({
  completeStagedPdfJob: jest.fn(),
}));
jest.mock('./settle-execution-failure', () => ({
  settleExecutionFailure: jest.fn(),
}));
jest.mock('./worker-observation-sink', () => ({
  workerObservationSink: jest.fn(),
}));
jest.mock('./lease-guard', () => ({
  leaseGuard: () => guard,
  underLease:
    jest.requireActual<typeof import('./under-lease')>('./under-lease')
      .underLease,
}));
const prisma = {} as PrismaService,
  credential = { principalId: 'worker', token: 'secret' },
  semantic = jest.fn();
let resolveTail: () => void, pending: number, lost: number;
beforeEach(() => {
  jest.clearAllMocks();
  controller = new AbortController();
  pending = 1;
  lost = 0;
  const tail = new Promise<void>((resolve) => {
    resolveTail = () => {
      pending = 0;
      lost = 1;
      resolve();
    };
  });
  jest.mocked(workerObservationSink).mockReturnValue({
    emit: jest.fn(),
    summary: () => ({
      pending,
      lost,
      state: pending ? 'PENDING' : 'PARTIAL',
    }),
    whenSettled: () => tail,
  });
  const claim = {
    jobId: 'job-fixture',
    job: JSON.parse(
      fixtureBytes('ava-pdf-job-1').toString(),
    ) as ClaimedPdfJob['job'],
    authority: {
      ...credential,
      attemptId: 'attempt-fixture',
      attemptToken: 'secret',
    },
  } as ClaimedPdfJob;
  jest.mocked(claimPdfJob).mockResolvedValue(claim);
  jest
    .mocked(runClaimedContent)
    .mockImplementation((_p, _c, _r, _s, _g, observer) => {
      observer?.emit('STAGE_ENDED', 'FILL_METADATA', 'unit-final', {});
      return Promise.resolve({
        completion: { exitCode: 2, bytes: Buffer.from('{}') },
        stagedByPath: {},
        metadata: [],
        profileId: 'ava-pdf-prose-en-v2',
      });
    });
  jest
    .mocked(completeStagedPdfJob)
    .mockResolvedValue({ status: 'WAITING', candidateId: 'candidate' });
  jest
    .mocked(settleExecutionFailure)
    .mockResolvedValue({ status: 'QUEUED', code: 'WORKER_CRASH' });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function turn() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
it('drains the final observation before settlement can hand the candidate to automatic publication', async () => {
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
  resolveTail();
  await expect(result).resolves.toMatchObject({
    status: 'WAITING',
    observationCapture: { pending: 0, lost: 1 },
  });
  expect(
    jest.mocked(completeStagedPdfJob).mock.calls[0][1].observationWatermark,
  ).toMatchObject({ sealed: true, throughOrdinal: 1, reportedFailures: 1 });
});
it('bounds optional draining to one second and preserves the known intended count and original result', async () => {
  jest.useFakeTimers();
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  await jest.advanceTimersByTimeAsync(999);
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toMatchObject({
    status: 'WAITING',
    observationCapture: { pending: 1, lost: 0 },
  });
  expect(
    jest.mocked(completeStagedPdfJob).mock.calls[0][1].observationWatermark,
  ).toMatchObject({ sealed: true, throughOrdinal: 1, reportedFailures: 0 });
});
it('preserves the original failure when a bounded optional drain times out', async () => {
  jest.useFakeTimers();
  const failure = new PdfRuntimeError('WORKER_CRASH');
  jest.mocked(runClaimedContent).mockRejectedValue(failure);
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  expect(settleExecutionFailure).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1000);
  await expect(result).resolves.toMatchObject({
    status: 'QUEUED',
    code: 'WORKER_CRASH',
  });
  expect(jest.mocked(settleExecutionFailure).mock.calls[0][2]).toBe(failure);
});
it('aborts the wait promptly without settling after authority is lost', async () => {
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  controller.abort();
  await expect(result).resolves.toMatchObject({ status: 'authority_lost' });
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
  expect(guard.dispose).toHaveBeenCalled();
});

it('does not let an optional drain rejection replace the original work failure', async () => {
  const failure = new PdfRuntimeError('WORKER_CRASH');
  jest.mocked(runClaimedContent).mockRejectedValue(failure);
  jest.mocked(workerObservationSink).mockReturnValue({
    emit: jest.fn(),
    summary: () => ({ pending: 0, lost: 1, state: 'PARTIAL' }),
    whenSettled: () => Promise.reject(new Error('private sink failure')),
  });
  await expect(
    executeOne(prisma, credential, testConfig, semantic),
  ).resolves.toMatchObject({ status: 'QUEUED', code: 'WORKER_CRASH' });
  expect(jest.mocked(settleExecutionFailure).mock.calls[0][2]).toBe(failure);
});
it('clears the bounded wait timer', async () => {
  jest.useFakeTimers();
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  resolveTail();
  await result;
  expect(jest.getTimerCount()).toBe(0);
});

it('clips the optional wait to the remaining valid lease', async () => {
  jest.useFakeTimers();
  jest.spyOn(guard, 'remainingMs').mockReturnValue(50);
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  await jest.advanceTimersByTimeAsync(49);
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toMatchObject({
    status: 'WAITING',
    observationCapture: { pending: 1, lost: 0 },
  });
  expect(jest.getTimerCount()).toBe(0);
});

it('does not spend a second drain budget when completion fails after the first timeout', async () => {
  jest.useFakeTimers();
  const failure = new PdfRuntimeError('WORKER_CRASH');
  jest.mocked(completeStagedPdfJob).mockRejectedValue(failure);
  const result = executeOne(prisma, credential, testConfig, semantic);
  await turn();
  await jest.advanceTimersByTimeAsync(1000);
  expect(settleExecutionFailure).toHaveBeenCalled();
  await expect(result).resolves.toMatchObject({
    status: 'QUEUED',
    code: 'WORKER_CRASH',
  });
  expect(jest.mocked(settleExecutionFailure).mock.calls[0][2]).toBe(failure);
  expect(jest.getTimerCount()).toBe(0);
});
