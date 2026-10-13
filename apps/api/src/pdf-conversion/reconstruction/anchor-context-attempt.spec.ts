import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { PdfRuntimeError } from '../runtime/runtime-error';
import {
  anchorParent,
  anchorOriginal,
  anchorTask,
  anchorResponse,
} from './anchor-context-fixture';
import { contextSha, contextTaskId } from './anchor-context-binding';

function setup(layoutPolicy = true) {
  const controller = new AbortController();
  const dispatch = jest
    .fn<
      ReturnType<AttemptContext['deps']['dispatch']>,
      Parameters<AttemptContext['deps']['dispatch']>
    >()
    .mockResolvedValueOnce({ output: JSON.stringify(anchorOriginal) })
    .mockResolvedValue({ output: JSON.stringify(anchorResponse) });
  const preflight = jest.fn<
    Promise<void>,
    [typeof anchorTask, typeof anchorParent, AbortSignal]
  >(() => Promise.resolve());
  const state = attemptExchanges({
    sourceSha256: anchorParent.source_sha256,
    profileId: anchorParent.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    ...(layoutPolicy
      ? { sourceLayoutPolicy: 'ava-native-layout-1' as const }
      : {}),
    validateAnchorContext: preflight,
    checkActive: (signal) => {
      if (signal.aborted) throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    },
    deps: {
      dispatch,
      progress: jest.fn(),
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
    },
  });
  let sequence = 0;
  const send = (kind: ExchangeEnvelope['kind'], payload: unknown) =>
    state.exchange(
      Buffer.from(
        JSON.stringify({
          schema_version:
            kind === 'anchor_context'
              ? 'ava-recognition-anchor-context-exchange-1'
              : 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: anchorParent.source_sha256,
          profile_id: anchorParent.profile_id,
          kind,
          payload,
        }),
      ),
      controller.signal,
    );
  const page = () =>
    send('page', {
      schema_version: layoutPolicy
        ? 'ava-prepare-result-2'
        : 'ava-prepare-result-1',
      ...(layoutPolicy ? { source_layout_policy: 'ava-native-layout-1' } : {}),
      source_sha256: anchorParent.source_sha256,
      source_page_count: 1,
      page_number: anchorParent.page_number,
      observation_sha256: 'b'.repeat(64),
      native_segment_count: 0,
      tasks: [anchorParent],
    });
  const recognize = () =>
    send('recognition', { task_id: anchorParent.task_id });
  const correct = (task = anchorTask) => send('anchor_context', task);
  return {
    state,
    send,
    page,
    recognize,
    correct,
    dispatch,
    controller,
    preflight,
  };
}

it('uses two distinct normally dispatched requests and then permits normal initial conversion completion', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  const reply = JSON.parse((await q.correct()).toString()) as ExchangeEnvelope;
  expect(reply.payload).toEqual([anchorResponse]);
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  expect(q.dispatch.mock.calls.map(([task]) => task.taskId)).toEqual([
    anchorParent.task_id,
    'anchor-context-parent-' + contextSha(anchorParent.task_id),
  ]);
  expect(q.dispatch.mock.calls[1][1]).toBe(q.controller.signal);
  expect(q.preflight).toHaveBeenCalledTimes(1);
  expect(q.preflight.mock.invocationCallOrder[0]).toBeLessThan(
    q.dispatch.mock.invocationCallOrder[1],
  );
  await q.send('refinement_batch', {
    schema_version: 'ava-book-refinement-batch-1',
    source_sha256: anchorParent.source_sha256,
    tasks: [],
  });
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 1, taskCount: 1 });
});

it('consumes one correction opportunity before dispatch and preserves WAIT error identity without retry', async () => {
  const q = setup(),
    waiting = new Error('CONTROLLED_PROVIDER_WAIT');
  await q.page();
  await q.recognize();
  q.dispatch.mockRejectedValue(waiting);
  await expect(q.correct()).rejects.toBe(waiting);
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
});

it('counts correction through the ordinary dispatcher cap rather than authorizing a seventieth request', async () => {
  const q = setup(),
    limit = new Error('CONTROLLED_REQUEST_LIMIT');
  let requests = 68;
  q.dispatch.mockReset().mockImplementation(() => {
    if (requests === 69) return Promise.reject(limit);
    requests++;
    return Promise.resolve({ output: JSON.stringify(anchorOriginal) });
  });
  await q.page();
  await q.recognize();
  await expect(q.correct()).rejects.toBe(limit);
  expect(requests).toBe(69);
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});

it('does not dispatch a pipelined correction while the original response is unresolved', async () => {
  const q = setup();
  let resolve!: (value: { output: string }) => void;
  q.dispatch.mockReset().mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await q.page();
  const original = q.recognize();
  await Promise.resolve();
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  resolve({ output: JSON.stringify(anchorOriginal) });
  await expect(original).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
});

it('does not advance or accept completion while correction dispatch is unresolved', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  let resolve!: (value: { output: string }) => void;
  q.dispatch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const corrective = q.correct();
  await Promise.resolve();
  await expect(
    q.send('refinement_batch', {
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: anchorParent.source_sha256,
      tasks: [],
    }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
  resolve({ output: JSON.stringify(anchorResponse) });
  await expect(corrective).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});

it('rejects a late correction after cancellation and a second correction for the same original', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  await q.correct();
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  const cancelled = setup();
  await cancelled.page();
  await cancelled.recognize();
  cancelled.dispatch.mockImplementation(() => {
    cancelled.controller.abort();
    return Promise.resolve({ output: JSON.stringify(anchorResponse) });
  });
  await expect(cancelled.correct()).rejects.toThrow('DISPATCH_NOT_AUTHORIZED');
  expect(() => cancelled.state.finish(0)).toThrow('INVALID_RESULT');
});

it('retains an unresolved receipt for the worker while preventing more paid tasks or successful finish', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  const unresolved = {
    ...anchorResponse,
    outcome: 'unresolved',
    patches: [],
    unresolved_reason: 'IMAGE_UNCLEAR',
  };
  q.dispatch.mockResolvedValue({ output: JSON.stringify(unresolved) });
  const reply = JSON.parse((await q.correct()).toString()) as ExchangeEnvelope;
  expect(reply.payload).toEqual([unresolved]);
  await expect(
    q.send('refinement_batch', {
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: anchorParent.source_sha256,
      tasks: [],
    }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});

it('refuses an injected correction on the historical no-layout path without extra provider work', async () => {
  const q = setup(false);
  await q.page();
  await q.recognize();
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.preflight).not.toHaveBeenCalled();
});

it('does not pay for correction when exact-parent semantic eligibility refuses', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  q.preflight.mockRejectedValue(new PdfRuntimeError('INVALID_RESULT'));
  await expect(q.correct()).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(() => q.state.finish(0)).toThrow('INVALID_RESULT');
});

function rebound(original: typeof anchorOriginal) {
  const task = structuredClone(anchorTask);
  task.original_response_json = JSON.stringify(original);
  task.original_response_sha256 = contextSha(task.original_response_json);
  for (const slot of task.slots) {
    const segment = original.segments[slot.segment_index];
    slot.segment_text_sha256 = contextSha(segment.text);
    slot.original_span_json = JSON.stringify(segment.spans[slot.span_index]);
    slot.span_sha256 = contextSha(slot.original_span_json);
  }
  task.task_id = contextTaskId(task);
  return task;
}
it('refuses a wrong-page parent before any corrective dispatch', async () => {
  const q = setup(),
    original = structuredClone(anchorOriginal);
  original.segments[0].page++;
  q.dispatch
    .mockReset()
    .mockResolvedValue({ output: JSON.stringify(original) });
  await q.page();
  await expect(q.recognize()).rejects.toThrow('SOURCE_MISMATCH');
  await expect(q.correct(rebound(original))).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.preflight).not.toHaveBeenCalled();
});
it('refuses an ambiguous reference-bearing span without paying to erase its evidence', async () => {
  const q = setup(),
    original = structuredClone(anchorOriginal);
  original.segments[0].spans[0].note_label = 'authored-note';
  q.dispatch
    .mockReset()
    .mockResolvedValue({ output: JSON.stringify(original) });
  await q.page();
  await q.recognize();
  await expect(q.correct(rebound(original))).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.preflight).not.toHaveBeenCalled();
});
it.each(['region', 'native-conservation'])(
  'honors the stock parser refusal of immutable %s evidence before corrective spending',
  async (kind) => {
    const q = setup(),
      original = structuredClone(anchorOriginal);
    if (kind === 'region') {
      original.segments[0].box.x0 = 900;
      original.segments[0].box.x1 = 800;
    } else
      original.segments[0].text = original.segments[0].text.replace(
        /[A-Za-z]/,
        '',
      );
    q.dispatch
      .mockReset()
      .mockResolvedValue({ output: JSON.stringify(original) });
    q.preflight.mockRejectedValue(new PdfRuntimeError('INVALID_RESULT'));
    await q.page();
    await q.recognize();
    const proposed = rebound(original);
    await expect(q.correct(proposed)).rejects.toThrow('INVALID_RESULT');
    expect(q.preflight).toHaveBeenCalledWith(
      proposed,
      anchorParent,
      q.controller.signal,
    );
    expect(q.dispatch).toHaveBeenCalledTimes(1);
  },
);
it('does not dispatch after a pipelined request invalidates an in-flight parser proof', async () => {
  const q = setup();
  await q.page();
  await q.recognize();
  let resolve!: () => void;
  q.preflight.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const corrective = q.correct();
  await Promise.resolve();
  await expect(
    q.send('refinement_batch', {
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: anchorParent.source_sha256,
      tasks: [],
    }),
  ).rejects.toThrow('INVALID_RESULT');
  resolve();
  await expect(corrective).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
