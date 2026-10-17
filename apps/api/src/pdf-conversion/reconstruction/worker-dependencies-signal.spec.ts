import { workerDependencies } from './worker-dependencies';
import { dispatchPdfProvider } from '../../library/pdf-import/providers/dispatch';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AttemptAuthority } from '../../library/pdf-import/jobs';
import type { PdfRuntimeConfig } from '../runtime/runtime-config';
import { providerTask } from './provider-task';
import { task } from './test-fixture';

jest.mock('../../library/pdf-import/providers/dispatch', () => ({
  dispatchPdfProvider: jest.fn(),
}));
const dispatch = jest.mocked(dispatchPdfProvider);

function setup() {
  const job = new AbortController(),
    session = new AbortController();
  const deps = workerDependencies(
    {} as PrismaService,
    {} as AttemptAuthority,
    {} as PdfRuntimeConfig,
    job.signal,
    () => Promise.resolve(),
  );
  dispatch.mockResolvedValue({
    output: '{}',
    callId: 'call-test',
    generationId: 'generation-test',
    actualNano: '0',
    reused: false,
  });
  return { deps, job, session };
}
beforeEach(() => jest.clearAllMocks());

it.each(['job', 'session'] as const)(
  'merges %s cancellation into the actual provider dispatch seam',
  async (which) => {
    const q = setup();
    await q.deps.dispatch(
      providerTask(task, task.source_sha256, 1),
      q.session.signal,
    );
    const signal = dispatch.mock.calls[0][1].signal!;
    expect(signal.aborted).toBe(false);
    q[which].abort();
    expect(signal.aborted).toBe(true);
  },
);

it('preserves the existing job signal when no session signal is supplied', async () => {
  const q = setup();
  await q.deps.dispatch(providerTask(task, task.source_sha256, 1));
  expect(dispatch.mock.calls[0][1].signal).toBe(q.job.signal);
});

it('forwards an already-aborted session before provider transport can start', async () => {
  const q = setup();
  q.session.abort();
  await q.deps.dispatch(
    providerTask(task, task.source_sha256, 1),
    q.session.signal,
  );
  expect(dispatch.mock.calls[0][1].signal!.aborted).toBe(true);
});
