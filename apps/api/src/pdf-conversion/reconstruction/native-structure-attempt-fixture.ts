import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { response } from './test-fixture';

export function nativeAttempt(providerMode = 'live', captured = true) {
  const controller = new AbortController();
  const dispatch = jest.fn<
    ReturnType<AttemptContext['deps']['dispatch']>,
    Parameters<AttemptContext['deps']['dispatch']>
  >((_task) =>
    Promise.resolve({
      output: JSON.stringify(
        _task.schemaVersion === nativeTask.response_schema_version
          ? nativeResponse
          : response,
      ),
    }),
  );
  const progress = jest.fn(() => Promise.resolve());
  const context: AttemptContext = {
    sourceSha256: nativeTask.source_sha256,
    profileId: nativeTask.profile_id,
    providerMode,
    pageLimit: 500,
    ...(captured
      ? {
          sourceLayoutPolicy: 'ava-native-layout-1' as const,
          sourceStructurePolicy: 'ava-native-structure-1' as const,
        }
      : {}),
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
              : 'ava-reconstruction-exchange-1'),
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
    schema_version: 'ava-prepare-result-3',
    source_layout_policy: 'ava-native-layout-1',
    source_structure_policy: 'ava-native-structure-1',
    source_sha256: nativeTask.source_sha256,
    profile_id: nativeTask.profile_id,
    source_page_count: 1,
    page_number: 1,
    observation_sha256: nativeTask.observation_sha256,
    native_segment_count: 0,
    tasks: [nativeTask],
  };
  const batch = {
    schema_version: 'ava-book-refinement-batch-1',
    source_sha256: nativeTask.source_sha256,
    tasks: [],
  };
  return { state, send, page, batch, controller, dispatch, progress, context };
}
