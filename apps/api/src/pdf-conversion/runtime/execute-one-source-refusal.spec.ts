import { executeOne } from './execute-one';
import { claimPdfJob, JobAuthorityError } from '../../library/pdf-import/jobs';
import { runClaimedContent } from './run-claimed-content';
import { retainSourceRefusal } from './retain-source-refusal';
import { settleExecutionFailure } from './settle-execution-failure';
import { completeStagedPdfJob } from '../../library/pdf-import/jobs/complete-staged';
import { testConfig } from './config-fixture';
import { recognitionRefusal } from '../reconstruction/recognition-refusal';
import { task, response } from '../reconstruction/test-fixture';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import { PdfRuntimeError } from './runtime-error';

const controller = new AbortController();
const guard = {
  signal: controller.signal,
  remainingMs: () => 1000,
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
jest.mock('./retain-source-refusal', () => ({
  retainSourceRefusal: jest.fn(),
}));
jest.mock('./settle-execution-failure', () => ({
  settleExecutionFailure: jest.fn(),
}));
jest.mock('../../library/pdf-import/jobs/complete-staged', () => ({
  completeStagedPdfJob: jest.fn(),
}));
jest.mock('./lease-guard', () => ({
  leaseGuard: () => guard,
  underLease: (work: () => unknown) => work(),
}));
const prisma = {} as PrismaService,
  semantic = jest.fn();
const credential = { principalId: 'worker', token: 'secret' };
beforeEach(() => {
  jest.clearAllMocks();
  const claim = {
    job: JSON.parse(fixtureBytes('ava-pdf-job-1').toString()) as JobInputV1,
    authority: { ...credential, attemptId: 'attempt', attemptToken: 'secret' },
  } as ClaimedPdfJob;
  jest.mocked(claimPdfJob).mockResolvedValue(claim);
});
it('retains source refusal as terminal owned diagnostic, never staged canonical content or generic retry', async () => {
  const refusal = recognitionRefusal(task, {
    ...response,
    unresolved: ['private prose'],
  });
  jest.mocked(runClaimedContent).mockRejectedValue(refusal);
  jest
    .mocked(retainSourceRefusal)
    .mockResolvedValue({ status: 'FAILED', failureId: 'failure' });
  await expect(
    executeOne(prisma, credential, testConfig, semantic),
  ).resolves.toMatchObject({ status: 'FAILED', code: 'UNSUPPORTED_PDF' });
  expect(retainSourceRefusal).toHaveBeenCalledTimes(1);
  expect(settleExecutionFailure).not.toHaveBeenCalled();
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
  expect(guard.dispose).toHaveBeenCalled();
});
it('losing attempt authority prevents refusal completion or accepted-content writes', async () => {
  jest
    .mocked(runClaimedContent)
    .mockRejectedValue(recognitionRefusal(task, response));
  jest.mocked(retainSourceRefusal).mockRejectedValue(new JobAuthorityError());
  await expect(
    executeOne(prisma, credential, testConfig, semantic),
  ).resolves.toMatchObject({ status: 'authority_lost' });
  expect(settleExecutionFailure).not.toHaveBeenCalled();
  expect(completeStagedPdfJob).not.toHaveBeenCalled();
});
it('ordinary infrastructure failures keep the existing recovery path', async () => {
  jest
    .mocked(runClaimedContent)
    .mockRejectedValue(new PdfRuntimeError('WORKER_CRASH'));
  jest
    .mocked(settleExecutionFailure)
    .mockResolvedValue({ status: 'QUEUED', code: 'WORKER_CRASH' });
  await expect(
    executeOne(prisma, credential, testConfig, semantic),
  ).resolves.toMatchObject({ status: 'QUEUED', code: 'WORKER_CRASH' });
  expect(retainSourceRefusal).not.toHaveBeenCalled();
  expect(settleExecutionFailure).toHaveBeenCalledTimes(1);
});
