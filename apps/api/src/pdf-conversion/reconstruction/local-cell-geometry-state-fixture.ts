import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import {
  geometryParent,
  geometryAnswer,
  geometryOriginalJson,
} from './cell-geometry-fixture';
import { localPeer, localPolicies } from './local-cell-geometry-fixture';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function localExchangeFixture() {
  const controller = new AbortController();
  const dispatch = jest
    .fn<
      ReturnType<AttemptContext['deps']['dispatch']>,
      Parameters<AttemptContext['deps']['dispatch']>
    >()
    .mockResolvedValueOnce({ output: geometryOriginalJson })
    .mockResolvedValue({ output: JSON.stringify(geometryAnswer) });
  const local = jest.fn(() => Promise.resolve(localPeer()));
  const state = attemptExchanges({
    ...localPolicies,
    sourceSha256: geometryParent.source_sha256,
    profileId: geometryParent.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    validateGeometry: () => Promise.resolve(),
    localizeCellGeometry: local,
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
      schema_version: 'ava-prepare-result-5',
      source_layout_policy: localPolicies.sourceLayoutPolicy,
      source_structure_policy: localPolicies.sourceStructurePolicy,
      source_normalization_policy: localPolicies.sourceNormalizationPolicy,
      source_sha256: geometryParent.source_sha256,
      profile_id: geometryParent.profile_id,
      source_page_count: 1,
      page_number: 1,
      observation_sha256: 'b'.repeat(64),
      native_segment_count: 0,
      tasks: [geometryParent],
    });
    await send('recognition', { task_id: geometryParent.task_id });
  };
  return { controller, dispatch, local, send, prepare };
}
