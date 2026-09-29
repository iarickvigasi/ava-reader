import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx, AttemptAuthority } from './types';
import { heartbeatPdfJob } from './heartbeat';
import { requireAttempt } from './authority';
import { jobTransaction } from './transaction';
import { leaseClock } from './lease-clock';
jest.mock('./authority');
jest.mock('./transaction');
jest.mock('./lease-clock');
const authority = {
  principalId: 'principal',
  token: 'secret',
  attemptId: 'attempt',
  attemptToken: 'attempt-secret',
};
function setup() {
  const update = jest
    .fn<Promise<object>, [{ data: Record<string, unknown> }]>()
    .mockResolvedValue({});
  const tx = {
    pdfJobAttempt: { update },
    pdfImportOperation: { update },
  } as unknown as Tx;
  jest.mocked(jobTransaction).mockImplementation((_, callback) => callback(tx));
  jest.mocked(requireAttempt).mockResolvedValue({
    attempt: {
      id: 'attempt',
      deadlineAt: new Date(9000),
      job: {
        operation: {
          id: 'op',
          stage: 'EXTRACTION',
          progressCompleted: 2,
          progressTotal: 3,
        },
      },
    },
    job: { source_page_limit: 3 },
    now: new Date(1000),
    policy: { leaseMs: 3000 },
  } as never);
  jest.mocked(leaseClock).mockResolvedValue({
    serverNow: new Date(1200),
    leaseRemainingMs: 2800,
    deadlineRemainingMs: 7800,
  });
  return { update };
}
beforeEach(() => jest.clearAllMocks());
it.each([
  { stage: 'PREFLIGHT' },
  { stage: 'UNKNOWN' },
  { stage: 'EXTRACTION', completed: 1 },
  { stage: 'EXTRACTION', completed: 4 },
  { stage: 'EXTRACTION', total: 4 },
  { stage: 'EXTRACTION', total: 2 },
])('rejects inaccurate progress %j', async (progress) => {
  const { update } = setup();
  await expect(
    heartbeatPdfJob({} as PrismaService, authority, progress as never),
  ).rejects.toThrow('PDF_JOB_PROGRESS_INVALID');
  expect(update).not.toHaveBeenCalled();
});
it('records progress in both current operation and retained attempt with DB duration', async () => {
  const { update } = setup();
  const output = await heartbeatPdfJob({} as PrismaService, authority, {
    stage: 'ASSEMBLY',
    completed: 3,
    total: 3,
  });
  expect(output.leaseRemainingMs).toBe(2800);
  expect(output.leaseExpiresAt).toEqual(new Date(4000));
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[0][0]).toMatchObject({
    data: { stage: 'ASSEMBLY', progressCompleted: 3, progressTotal: 3 },
  });
});
it('snapshots mutable heartbeat credentials and progress before awaiting transaction', async () => {
  setup();
  let run: (() => Promise<unknown>) | undefined;
  jest.mocked(jobTransaction).mockImplementation(
    (_, callback) =>
      new Promise((resolve) => {
        run = () =>
          callback({
            pdfJobAttempt: { update: () => Promise.resolve() },
            pdfImportOperation: { update: () => Promise.resolve() },
          } as unknown as Tx).then(resolve);
      }),
  );
  const credential: AttemptAuthority = { ...authority },
    progress = { stage: 'EXTRACTION' as const, completed: 3, total: 3 };
  const pending = heartbeatPdfJob({} as PrismaService, credential, progress);
  credential.attemptId = 'changed';
  progress.completed = 0;
  await run!();
  await pending;
  expect(jest.mocked(requireAttempt).mock.calls[0][1]).toEqual(authority);
});
