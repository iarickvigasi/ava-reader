import { attemptExchanges } from './attempt-exchanges';
import { task, response, prepared } from './test-fixture';
import { refinementTask, refinementResponse } from './refinement-fixture';
import { recognitionRefusal } from './recognition-refusal';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import type { AttemptContext } from './attempt-provider';

function setup(providerMode = 'live') {
  const controller = new AbortController();
  const dispatch = jest.fn<
    ReturnType<AttemptContext['deps']['dispatch']>,
    Parameters<AttemptContext['deps']['dispatch']>
  >(() => Promise.resolve({ output: JSON.stringify(response) }));
  const progress = jest.fn(() => Promise.resolve());
  const context: AttemptContext = {
    sourceSha256: task.source_sha256,
    profileId: task.profile_id,
    pageLimit: 500,
    providerMode,
    checkActive: (signal) => {
      if (signal.aborted) throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    },
    deps: {
      dispatch,
      progress,
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
    },
  };
  const state = attemptExchanges(context);
  let sequence = 0;
  const send = (
    kind: ExchangeEnvelope['kind'],
    payload: unknown,
    extra: object = {},
  ) =>
    state.exchange(
      Buffer.from(
        JSON.stringify({
          schema_version: 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: task.source_sha256,
          profile_id: task.profile_id,
          kind,
          payload,
          ...extra,
        }),
      ),
      controller.signal,
    );
  const batch = (tasks: unknown[] = []) => ({
    schema_version: 'ava-book-refinement-batch-1',
    source_sha256: task.source_sha256,
    tasks,
  });
  return { state, send, batch, controller, dispatch, progress };
}

const replyEnvelope = (bytes: Buffer) =>
  JSON.parse(bytes.toString()) as ExchangeEnvelope;

it('uses empty page/batch acknowledgements and completes native content without provider work', async () => {
  const q = setup('native');
  const page = { ...prepared, native_segment_count: 2, tasks: [] };
  expect(replyEnvelope(await q.send('page', page)).payload).toEqual([]);
  expect(q.progress).not.toHaveBeenCalled();
  expect(
    replyEnvelope(await q.send('refinement_batch', q.batch())).payload,
  ).toEqual([]);
  expect(q.progress.mock.calls).toEqual([
    [{ stage: 'EXTRACTION', completed: 1, total: 1 }],
    [{ stage: 'RECONSTRUCTION' }],
  ]);
  expect(await q.send('artifacts', null)).toEqual(Buffer.alloc(0));
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 0 });
  expect(q.dispatch).not.toHaveBeenCalled();
});

it('dispatches only the requested bound task and passes the session abort signal', async () => {
  const q = setup();
  const second = { ...task, task_id: 'task-page-1-second' };
  await q.send('page', { ...prepared, tasks: [task, second] });
  expect(q.dispatch).not.toHaveBeenCalled();
  const reply = replyEnvelope(
    await q.send('recognition', { task_id: task.task_id }),
  );
  expect(reply.payload).toEqual([response]);
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.dispatch.mock.calls[0][1]).toBe(q.controller.signal);
  expect(q.progress).not.toHaveBeenCalled();
});

it('does not spend on the next task after an immediate invalid response', async () => {
  const q = setup();
  q.dispatch.mockResolvedValue({
    output: JSON.stringify({ ...response, source_sha256: 'b'.repeat(64) }),
  });
  await q.send('page', {
    ...prepared,
    tasks: [task, { ...task, task_id: 'second' }],
  });
  await expect(
    q.send('recognition', { task_id: task.task_id }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  await expect(q.send('recognition', { task_id: 'second' })).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
});

it('retains a worker semantic refusal after one response without requesting another call or reporting page complete', async () => {
  const q = setup();
  await q.send('page', {
    ...prepared,
    tasks: [task, { ...task, task_id: 'second' }],
  });
  await q.send('recognition', { task_id: task.task_id });
  const error = recognitionRefusal(task, {
    ...response,
    unresolved: ['not a log field'],
  });
  expect(await q.send('refusal', error.diagnostic())).toEqual(Buffer.alloc(0));
  expect(() => q.state.finish(1)).toThrow('UNSUPPORTED_PDF');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.progress).not.toHaveBeenCalled();
});

it('preserves provider WAIT error identity and refuses further work in that session', async () => {
  const q = setup();
  const waiting = new Error('provider waiting');
  q.dispatch.mockRejectedValue(waiting);
  await q.send('page', prepared);
  await expect(q.send('recognition', { task_id: task.task_id })).rejects.toBe(
    waiting,
  );
  await expect(
    q.send('recognition', { task_id: task.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});

it('rejects wrong first binding before any provider or progress action', async () => {
  const q = setup();
  await expect(
    q.send('page', prepared, { source_sha256: 'b'.repeat(64) }),
  ).rejects.toThrow('SOURCE_MISMATCH');
  expect(q.dispatch).not.toHaveBeenCalled();
  expect(q.progress).not.toHaveBeenCalled();
});

it.each([
  { ...prepared, source_page_count: 501 },
  { ...prepared, page_number: 2 },
  { ...prepared, tasks: [{ ...task, page_number: 2 }] },
  { ...prepared, tasks: [{ ...task, profile_id: 'ava-pdf-prose-en-uk-v3' }] },
])('rejects bad page/task coverage before dispatch', async (page) => {
  const q = setup();
  await expect(q.send('page', page)).rejects.toBeInstanceOf(PdfRuntimeError);
  expect(q.dispatch).not.toHaveBeenCalled();
});

it('requires every advertised page before accepting refinement', async () => {
  const q = setup('native');
  await q.send('page', { ...prepared, source_page_count: 2, tasks: [] });
  await expect(q.send('refinement_batch', q.batch())).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).not.toHaveBeenCalled();
});

it('rejects globally repeated task IDs across pages', async () => {
  const q = setup();
  await q.send('page', { ...prepared, source_page_count: 2 });
  await q.send('recognition', { task_id: task.task_id });
  await expect(
    q.send('page', {
      ...prepared,
      source_page_count: 2,
      page_number: 2,
      tasks: [{ ...task, page_number: 2 }],
    }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});

it('refines only advertised tasks, checks native-mode spending and requires terminal artifacts', async () => {
  const q = setup();
  await q.send('page', { ...prepared, tasks: [] });
  await q.send('refinement_batch', q.batch([refinementTask]));
  q.dispatch.mockResolvedValue({ output: JSON.stringify(refinementResponse) });
  const reply = replyEnvelope(
    await q.send('refinement', { task_id: refinementTask.task_id }),
  );
  expect(reply.payload).toEqual([refinementResponse]);
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 0 });
  const native = setup('native');
  await native.send('page', { ...prepared, tasks: [] });
  await expect(
    native.send('refinement_batch', native.batch([refinementTask])),
  ).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(native.dispatch).not.toHaveBeenCalled();
});

it('does not accept a late provider response after session cancellation', async () => {
  const q = setup();
  let resolve!: (value: { output: string }) => void;
  q.dispatch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await q.send('page', prepared);
  const reply = q.send('recognition', { task_id: task.task_id });
  await Promise.resolve();
  q.controller.abort();
  resolve({ output: JSON.stringify(response) });
  await expect(reply).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(q.progress).not.toHaveBeenCalled();
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
});
