import { createHash } from 'node:crypto';
import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import type { SandboxInput } from '../runtime/container-arguments';
import { refineBook } from './refine-book';
import { prepared } from './test-fixture';
import {
  printedTitleTask,
  printedTitleResponse,
} from './printed-title-fixture';
import { refinementTask, refinementResponse } from './refinement-fixture';
const historicalTask = {
  ...refinementTask,
  profile_id: printedTitleTask.profile_id,
};
const batch = {
  schema_version: 'ava-book-refinement-batch-2',
  source_sha256: printedTitleTask.source_sha256,
  tasks: [historicalTask, printedTitleTask],
};
function streaming(providerMode = 'live') {
  const signal = new AbortController().signal;
  const dispatch = jest
    .fn()
    .mockResolvedValueOnce({ output: JSON.stringify(refinementResponse) })
    .mockResolvedValueOnce({ output: JSON.stringify(printedTitleResponse) });
  const context: AttemptContext = {
    sourceSha256: printedTitleTask.source_sha256,
    profileId: printedTitleTask.profile_id,
    providerMode,
    pageLimit: 500,
    checkActive: () => {},
    deps: {
      dispatch,
      progress: jest.fn(),
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
    },
  };
  const state = attemptExchanges(context);
  let sequence = 0;
  const send = (kind: ExchangeEnvelope['kind'], payload: unknown) =>
    state.exchange(
      Buffer.from(
        JSON.stringify({
          schema_version: 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: context.sourceSha256,
          profile_id: context.profileId,
          kind,
          payload,
        }),
      ),
      signal,
    );
  return { state, send, dispatch };
}
it('streams the old task and one separate title classification in a bound B2 round trip', async () => {
  const q = streaming();
  await q.send('page', {
    ...prepared,
    profile_id: printedTitleTask.profile_id,
    native_segment_count: 2,
    tasks: [],
  });
  await q.send('refinement_batch', batch);
  expect(q.dispatch).not.toHaveBeenCalled();
  for (const [task, response] of [
    [refinementTask, refinementResponse],
    [printedTitleTask, printedTitleResponse],
  ] as const) {
    const reply = JSON.parse(
      (await q.send('refinement', { task_id: task.task_id })).toString(),
    ) as ExchangeEnvelope;
    expect(reply.payload).toEqual([response]);
  }
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toMatchObject({ pageCount: 1 });
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});
it('native-only and foreign-source B2 reject before any provider call', async () => {
  const native = streaming('native');
  await native.send('page', {
    ...prepared,
    profile_id: printedTitleTask.profile_id,
    native_segment_count: 2,
    tasks: [],
  });
  await expect(native.send('refinement_batch', batch)).rejects.toThrow(
    'DISPATCH_NOT_AUTHORIZED',
  );
  expect(native.dispatch).not.toHaveBeenCalled();
  const foreign = streaming();
  await foreign.send('page', {
    ...prepared,
    profile_id: printedTitleTask.profile_id,
    native_segment_count: 2,
    tasks: [],
  });
  await expect(
    foreign.send('refinement_batch', {
      ...batch,
      source_sha256: 'f'.repeat(64),
    }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  expect(foreign.dispatch).not.toHaveBeenCalled();
});
it('standalone refinement retains semantic pre/post-validation with an exact request-hash receipt', async () => {
  const events: string[] = [];
  const sandbox = jest.fn((input: SandboxInput) => {
    const raw = JSON.parse(input.auxiliaryBytes!.toString()) as {
      mode: string;
    };
    events.push(raw.mode);
    return Promise.resolve({
      exitCode: 0,
      stdout: Buffer.from(
        JSON.stringify(
          raw.mode === 'prepare_refinement'
            ? { ...batch, tasks: [printedTitleTask] }
            : {
                schema_version: 'ava-refinement-validation-1',
                valid: true,
                request_sha256: createHash('sha256')
                  .update(input.auxiliaryBytes!)
                  .digest('hex'),
              },
        ),
      ),
      faultAcknowledged: false,
      faultAcknowledgement: undefined,
    });
  });
  const dispatch = jest.fn(() => {
    events.push('dispatch');
    return Promise.resolve({ output: JSON.stringify(printedTitleResponse) });
  });
  expect(
    await refineBook({
      responses: [],
      sourceSha256: printedTitleTask.source_sha256,
      profileId: printedTitleTask.profile_id,
      providerMode: 'stub',
      deps: {
        sandbox,
        dispatch,
        stageArtifact: jest.fn(),
        progress: jest.fn(),
      },
      sandboxInput: () => ({
        module: 'ava_pdf_epub.reconstruction_v2',
        source: Buffer.from('authored source'),
        deadlineMs: 1000,
        scratchBytes: 1000,
      }),
    }),
  ).toEqual([printedTitleResponse]);
  expect(events).toEqual([
    'prepare_refinement',
    'validate_refinement',
    'dispatch',
    'validate_refinement',
  ]);
});

it('a foreign title reply fails the stream before any later task can dispatch', async () => {
  const q = streaming();
  q.dispatch.mockReset().mockResolvedValueOnce({
    output: JSON.stringify({
      ...printedTitleResponse,
      source_sha256: 'f'.repeat(64),
    }),
  });
  await q.send('page', {
    ...prepared,
    profile_id: printedTitleTask.profile_id,
    native_segment_count: 2,
    tasks: [],
  });
  const later = { ...historicalTask, task_id: 'later-structure' };
  await q.send('refinement_batch', {
    ...batch,
    tasks: [printedTitleTask, later],
  });
  await expect(
    q.send('refinement', { task_id: printedTitleTask.task_id }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(
    q.send('refinement', { task_id: later.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
