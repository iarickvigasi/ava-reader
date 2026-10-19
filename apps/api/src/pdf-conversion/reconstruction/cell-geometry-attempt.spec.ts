import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { PdfRuntimeError } from '../runtime/runtime-error';
import {
  geometryParent,
  geometryTask,
  geometryAnswer,
  geometryOriginalJson,
} from './cell-geometry-fixture';
import { geometrySha } from './geometry-binding';

function setup(policy: boolean | 'legacy' = true) {
  const controller = new AbortController();
  const dispatch = jest
    .fn<
      ReturnType<AttemptContext['deps']['dispatch']>,
      Parameters<AttemptContext['deps']['dispatch']>
    >()
    .mockResolvedValueOnce({ output: geometryOriginalJson })
    .mockResolvedValue({ output: JSON.stringify(geometryAnswer) });
  const preflight = jest.fn(() => Promise.resolve());
  const state = attemptExchanges({
    sourceSha256: geometryParent.source_sha256,
    profileId: geometryParent.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    sourceLayoutPolicy: 'ava-native-layout-1',
    sourceStructurePolicy: policy
      ? 'ava-native-structure-2'
      : 'ava-native-structure-1',
    sourceNormalizationPolicy: 'ava-native-word-wrap-1',
    ...(policy
      ? { sourceTitlePolicy: 'ava-frontmatter-title-1' as const }
      : {}),
    ...(policy
      ? {
          recognitionRepairPolicy:
            policy === 'legacy'
              ? ('ava-recognition-geometry-repair-1' as const)
              : ('ava-recognition-geometry-repair-2' as const),
        }
      : {}),
    validateGeometry: preflight,
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
            kind === 'geometry'
              ? 'ava-recognition-geometry-exchange-1'
              : kind === 'anchor_context'
                ? 'ava-recognition-anchor-context-exchange-1'
                : 'ava-reconstruction-exchange-2',
          sequence: ++sequence,
          source_sha256: geometryParent.source_sha256,
          profile_id: geometryParent.profile_id,
          kind,
          payload,
        }),
      ),
      controller.signal,
    );
  const prepare = async () => {
    await send('page', {
      schema_version: policy ? 'ava-prepare-result-5' : 'ava-prepare-result-4',
      source_layout_policy: 'ava-native-layout-1',
      source_structure_policy: policy
        ? 'ava-native-structure-2'
        : 'ava-native-structure-1',
      source_normalization_policy: 'ava-native-word-wrap-1',
      source_sha256: geometryParent.source_sha256,
      profile_id: geometryParent.profile_id,
      source_page_count: 1,
      page_number: 1,
      observation_sha256: 'b'.repeat(64),
      native_segment_count: 0,
      tasks: [geometryParent],
    });
    return send('recognition', { task_id: geometryParent.task_id });
  };
  return { send, prepare, dispatch, preflight, state, controller };
}
it('preserves exact original output in Input9 reply and dispatches only after independent eligibility', async () => {
  const q = setup();
  const reply = JSON.parse((await q.prepare()).toString()) as ExchangeEnvelope;
  expect(reply.payload).toEqual([
    {
      schema_version: 'ava-recognition-attempt-reply-1',
      response: JSON.parse(geometryOriginalJson) as unknown,
      original_response_json: geometryOriginalJson,
      original_response_sha256: geometrySha(geometryOriginalJson),
    },
  ]);
  const corrected = JSON.parse(
    (await q.send('geometry', geometryTask)).toString(),
  ) as ExchangeEnvelope;
  expect(corrected.payload).toEqual([geometryAnswer]);
  expect(q.preflight).toHaveBeenCalledTimes(1);
  expect(q.preflight.mock.invocationCallOrder[0]).toBeLessThan(
    q.dispatch.mock.invocationCallOrder[1],
  );
  expect(q.dispatch).toHaveBeenCalledTimes(2);
  expect(q.dispatch.mock.calls[1][0].taskId).toBe(
    'anchor-context-parent-' + geometrySha(geometryParent.task_id),
  );
});
it('keeps historical unopted reply and rejects geometry with no extra dispatch', async () => {
  const q = setup(false);
  const reply = JSON.parse((await q.prepare()).toString()) as ExchangeEnvelope;
  expect(reply.payload).toEqual([JSON.parse(geometryOriginalJson)]);
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it('does not spend when source eligibility fails', async () => {
  const q = setup();
  await q.prepare();
  q.preflight.mockRejectedValue(new PdfRuntimeError('INVALID_RESULT'));
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it.each(['geometry', 'anchor_context'] as const)(
  'consumes the shared opportunity before a second %s',
  async (kind) => {
    const q = setup();
    await q.prepare();
    await q.send('geometry', geometryTask);
    await expect(q.send(kind, geometryTask)).rejects.toThrow('INVALID_RESULT');
    expect(q.dispatch).toHaveBeenCalledTimes(2);
  },
);
it('retains unresolved outcome but refuses advancing or correcting again', async () => {
  const q = setup();
  await q.prepare();
  q.dispatch.mockResolvedValue({
    output: JSON.stringify({
      ...geometryAnswer,
      outcome: 'unresolved',
      patches: [],
      unresolved_reason: 'IMAGE_UNCLEAR',
    }),
  });
  await q.send('geometry', geometryTask);
  await expect(q.send('refinement_batch', {})).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});
it('honors dispatch cap and consumes WAIT failure without retry', async () => {
  const q = setup();
  await q.prepare();
  const wait = new Error('CONTROLLED_PROVIDER_WAIT');
  q.dispatch.mockRejectedValue(wait);
  await expect(q.send('geometry', geometryTask)).rejects.toBe(wait);
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.dispatch).toHaveBeenCalledTimes(2);
});
it('does not dispatch after concurrent input invalidates an in-flight eligibility check', async () => {
  const q = setup();
  await q.prepare();
  let resolve!: () => void;
  q.preflight.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const correction = q.send('geometry', geometryTask);
  await Promise.resolve();
  await expect(q.send('refinement_batch', {})).rejects.toThrow(
    'INVALID_RESULT',
  );
  resolve();
  await expect(correction).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});

it('denies altered cell addresses before preflight', async () => {
  const q = setup();
  await q.prepare();
  const changed = structuredClone(geometryTask);
  changed.slots[0].row_index++;
  await expect(q.send('geometry', changed)).rejects.toThrow();
  expect(q.preflight).not.toHaveBeenCalled();
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});

it('cannot borrow cell authority from the segment-only policy', async () => {
  const q = setup('legacy');
  await q.prepare();
  await expect(q.send('geometry', geometryTask)).rejects.toThrow(
    'INVALID_RESULT',
  );
  expect(q.preflight).not.toHaveBeenCalled();
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
