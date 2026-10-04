import { retainSourceRefusal } from './retain-source-refusal';
import { completePdfJob } from '../../library/pdf-import/jobs/complete';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JobInputV1 } from '../contracts/generated/ava-pdf-job-1';
import { recognitionRefusal } from '../reconstruction/recognition-refusal';
import { task, response } from '../reconstruction/test-fixture';
import { checksumBuffer } from '../../shared/blob-utils';
import { validateContract } from '../contracts/validate-contract';
import { validateCompletion } from '../contracts/validate-completion';
jest.mock('../../library/pdf-import/jobs/complete', () => ({
  completePdfJob: jest.fn(),
}));

function claim() {
  return {
    job: JSON.parse(fixtureBytes('ava-pdf-job-1').toString()) as JobInputV1,
    authority: {
      principalId: 'worker',
      token: 'secret',
      attemptId: 'attempt',
      attemptToken: 'secret',
    },
  } as ClaimedPdfJob;
}
const semantic = () => Promise.resolve(true);
beforeEach(() => jest.mocked(completePdfJob).mockReset());
it('uses validated immutable failure/diagnostic contract and existing authority path, with no readable output', async () => {
  const current = claim();
  const snapshot = structuredClone(current);
  const error = recognitionRefusal(
    { ...task, source_sha256: current.job.source.sha256 },
    { ...response, unresolved: ['private prose'] },
  );
  jest
    .mocked(completePdfJob)
    .mockResolvedValue({ status: 'FAILED', failureId: 'failure' });
  await expect(
    retainSourceRefusal({} as PrismaService, current, error, semantic),
  ).resolves.toMatchObject({ status: 'FAILED' });
  expect(current).toEqual(snapshot);
  const sent = jest.mocked(completePdfJob).mock.calls[0][1];
  const job = await validateContract(
    'ava-pdf-job-1',
    fixtureBytes('ava-pdf-job-1'),
    semantic,
  );
  const result = await validateCompletion(job, sent.completion, semantic);
  expect(result.outcome).toMatchObject({
    status: 'unsupported',
    cli_exit_code: 1,
    reader_retry_allowed: false,
    investigation_required: true,
  });
  expect(sent.artifacts).toHaveLength(1);
  expect(sent.artifacts[0].id).toBe('source-refusal');
  if (result.outcome.status === 'candidate')
    throw new Error('A refusal became readable');
  expect(result.outcome.diagnostic.sha256).toBe(
    checksumBuffer(sent.artifacts[0].bytes),
  );
  expect(sent.artifacts[0].bytes.toString()).not.toContain('private prose');
  expect(sent.artifacts[0].bytes.toString()).not.toContain('secret');
  expect(sent.authority).toEqual(current.authority);
});
it('refuses foreign source/over-limit page before persistence or changing accepted content', () => {
  const current = claim();
  current.job.source_page_limit = 1;
  const snapshot = structuredClone(current);
  const foreign = recognitionRefusal(
    { ...task, source_sha256: 'b'.repeat(64) },
    response,
  );
  expect(() =>
    retainSourceRefusal({} as PrismaService, current, foreign, semantic),
  ).toThrow('SOURCE_MISMATCH');
  const page = recognitionRefusal(
    {
      ...task,
      source_sha256: current.job.source.sha256,
      page_number: current.job.source_page_limit + 1,
    },
    response,
  );
  expect(() =>
    retainSourceRefusal({} as PrismaService, current, page, semantic),
  ).toThrow('SOURCE_MISMATCH');
  expect(completePdfJob).not.toHaveBeenCalled();
  expect(current).toEqual(snapshot);
});
