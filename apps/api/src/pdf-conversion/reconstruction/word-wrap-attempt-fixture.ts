import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { wrapBatch, wrapResponses } from './word-wrap-fixture';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { response } from './test-fixture';

type Validation = AttemptContext['validateWordWrap'] | null;
export function wrapAttempt(providerMode = 'live', validation?: Validation) {
  const controller = new AbortController();
  const dispatch = jest.fn<
    ReturnType<AttemptContext['deps']['dispatch']>,
    Parameters<AttemptContext['deps']['dispatch']>
  >((task) =>
    Promise.resolve({
      output: JSON.stringify(
        task.schemaVersion === 'ava-native-word-wrap-response-1'
          ? wrapResponses.find((r) => r.task_id === task.taskId)
          : task.schemaVersion === nativeTask.response_schema_version
            ? nativeResponse
            : response,
      ),
    }),
  );
  const progress = jest.fn(() => Promise.resolve());
  const context: AttemptContext = {
    sourceSha256: wrapBatch.source_sha256,
    profileId: wrapBatch.profile_id,
    providerMode,
    pageLimit: 500,
    sourceLayoutPolicy: 'ava-native-layout-1',
    sourceStructurePolicy: 'ava-native-structure-1',
    sourceNormalizationPolicy: 'ava-native-word-wrap-1',
    validateWordWrap:
      validation === null
        ? undefined
        : (validation ?? jest.fn(() => Promise.resolve())),
    checkActive: (signal) => {
      if (signal.aborted) throw new Error('DISPATCH_NOT_AUTHORIZED');
    },
    deps: { dispatch, progress, sandbox: jest.fn(), stageArtifact: jest.fn() },
  };
  const state = attemptExchanges(context);
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
              ? 'ava-native-structure-exchange-1'
              : 'ava-reconstruction-exchange-2'),
          sequence: ++sequence,
          source_sha256: context.sourceSha256,
          profile_id: context.profileId,
          kind,
          payload,
        }),
      ),
      controller.signal,
    );
  const page = {
    schema_version: 'ava-prepare-result-4',
    source_layout_policy: context.sourceLayoutPolicy,
    source_structure_policy: context.sourceStructurePolicy,
    source_normalization_policy: context.sourceNormalizationPolicy,
    profile_id: context.profileId,
    source_sha256: context.sourceSha256,
    source_page_count: 1,
    page_number: 1,
    observation_sha256: nativeTask.observation_sha256,
    native_segment_count: 1,
    tasks: [],
  };
  const batch = {
    schema_version: 'ava-book-refinement-batch-1',
    source_sha256: context.sourceSha256,
    tasks: [],
  };
  const prepare = async () => {
    await send('page', page);
    await send('refinement_batch', batch);
  };
  return {
    context,
    controller,
    dispatch,
    progress,
    state,
    send,
    page,
    batch,
    prepare,
  };
}
