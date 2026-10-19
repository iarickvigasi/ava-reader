import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { nativeTask2, nativeResponse2 } from './native-structure-v2-fixture';
import { nativeResponse } from './native-structure-fixture';

function setup(output = JSON.stringify(nativeResponse2)) {
  const dispatch = jest.fn<
    ReturnType<AttemptContext['deps']['dispatch']>,
    Parameters<AttemptContext['deps']['dispatch']>
  >(() => Promise.resolve({ output }));
  const context: AttemptContext = {
    sourceSha256: nativeTask2.source_sha256,
    profileId: nativeTask2.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    sourceLayoutPolicy: 'ava-native-layout-1',
    sourceStructurePolicy: 'ava-native-structure-2',
    sourceNormalizationPolicy: 'ava-native-word-wrap-1',
    recognitionRepairPolicy: 'ava-recognition-geometry-repair-1',
    sourceTitlePolicy: 'ava-frontmatter-title-1',
    checkActive: () => {},
    deps: {
      dispatch,
      progress: jest.fn(() => Promise.resolve()),
      sandbox: jest.fn(),
      stageArtifact: jest.fn(),
    },
  };
  const state = attemptExchanges(context),
    signal = new AbortController().signal;
  let sequence = 0;
  const send = (
    kind: ExchangeEnvelope['kind'],
    payload: unknown,
    marker?: string,
  ) =>
    state.exchange(
      Buffer.from(
        JSON.stringify({
          schema_version:
            marker ??
            (kind === 'native_structure'
              ? 'ava-native-structure-exchange-2'
              : 'ava-reconstruction-exchange-2'),
          sequence: ++sequence,
          source_sha256: context.sourceSha256,
          profile_id: context.profileId,
          kind,
          payload,
        }),
      ),
      signal,
    );
  const page = {
    schema_version: 'ava-prepare-result-5',
    source_layout_policy: context.sourceLayoutPolicy,
    source_structure_policy: context.sourceStructurePolicy,
    source_normalization_policy: context.sourceNormalizationPolicy,
    source_sha256: context.sourceSha256,
    profile_id: context.profileId,
    source_page_count: 1,
    page_number: 1,
    observation_sha256: nativeTask2.observation_sha256,
    native_segment_count: 0,
    tasks: [nativeTask2],
  };
  return { dispatch, state, send, page };
}
it('dispatches one advertised Native2 task and returns its original typed receipt without an extra correction', async () => {
  const original = structuredClone(nativeResponse2);
  original.groups.reverse();
  const q = setup(JSON.stringify(original));
  await q.send('page', q.page);
  expect(q.dispatch).not.toHaveBeenCalled();
  const bytes = await q.send('native_structure', {
    task_id: nativeTask2.task_id,
  });
  const reply = JSON.parse(bytes.toString()) as ExchangeEnvelope;
  expect(reply.schema_version).toBe('ava-native-structure-exchange-2');
  expect(reply.payload).toEqual([original]);
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.dispatch.mock.calls[0][0]).toMatchObject({
    purpose: 'resolve_structure',
    promptVersion: 'ava-native-structure-2',
    schemaVersion: 'ava-native-structure-response-2',
  });
  await expect(
    q.send('native_structure', { task_id: nativeTask2.task_id }),
  ).rejects.toThrow('INVALID_RESULT');
  expect(q.dispatch).toHaveBeenCalledTimes(1);
});
it.each(['legacy-namespace', 'wrong-kind', 'legacy-prepare'])(
  'rejects %s before provider dispatch',
  async (change) => {
    const q = setup();
    if (change === 'legacy-prepare')
      await expect(
        q.send('page', { ...q.page, schema_version: 'ava-prepare-result-4' }),
      ).rejects.toThrow('INVALID_RESULT');
    else {
      await q.send('page', q.page);
      await expect(
        q.send(
          change === 'wrong-kind' ? 'recognition' : 'native_structure',
          { task_id: nativeTask2.task_id },
          change === 'legacy-namespace'
            ? 'ava-native-structure-exchange-1'
            : undefined,
        ),
      ).rejects.toThrow('INVALID_RESULT');
    }
    expect(q.dispatch).not.toHaveBeenCalled();
  },
);
it.each([
  JSON.stringify(nativeResponse),
  JSON.stringify({ ...nativeResponse2, source_sha256: 'f'.repeat(64) }),
])(
  'keeps invalid replies terminal with no correction or later paid task',
  async (output) => {
    const q = setup(output);
    await q.send('page', q.page);
    await expect(
      q.send('native_structure', { task_id: nativeTask2.task_id }),
    ).rejects.toThrow();
    await expect(q.send('page', q.page)).rejects.toThrow('INVALID_RESULT');
    expect(q.dispatch).toHaveBeenCalledTimes(1);
  },
);
