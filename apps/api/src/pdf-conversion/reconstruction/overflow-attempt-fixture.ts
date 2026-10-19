import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { recognitionDecodedOutput } from './recognition-decoded-output';
import {
  overflowParent,
  overflowOriginal,
  overflowResponse,
} from './overflow-context-fixture';

export function overflowAttemptFixture(
  allowOverflow = true,
  denied = false,
  continuation = true,
) {
  const dispatch = jest
    .fn<
      ReturnType<AttemptContext['deps']['dispatch']>,
      Parameters<AttemptContext['deps']['dispatch']>
    >()
    .mockResolvedValueOnce({
      output: recognitionDecodedOutput(
        overflowParent,
        JSON.stringify(overflowOriginal),
      ),
    })
    .mockResolvedValue({ output: JSON.stringify(overflowResponse) });
  const preflight = jest.fn(() =>
    denied ? Promise.reject(new Error('preflight denied')) : Promise.resolve(),
  );
  const state = attemptExchanges({
    sourceSha256: overflowParent.source_sha256,
    profileId: overflowParent.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    sourceLayoutPolicy: 'ava-native-layout-1',
    ...(allowOverflow
      ? {
          recognitionRepairPolicy: 'ava-recognition-geometry-repair-2' as const,
        }
      : {}),
    ...(continuation
      ? {
          sourceContinuationPolicy:
            'ava-source-continuation-presentation-1' as const,
        }
      : {}),
    validateAnchorContext: preflight,
    checkActive: jest.fn(),
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
          source_sha256: overflowParent.source_sha256,
          profile_id: overflowParent.profile_id,
          kind,
          payload,
        }),
      ),
      new AbortController().signal,
    );
  const page = (tasks = [overflowParent]) =>
    send('page', {
      schema_version: 'ava-prepare-result-2',
      source_layout_policy: 'ava-native-layout-1',
      source_sha256: overflowParent.source_sha256,
      source_page_count: 1,
      page_number: 1,
      profile_id: overflowParent.profile_id,
      observation_sha256: 'b'.repeat(64),
      native_segment_count: 0,
      tasks,
    });
  return { send, page, dispatch, preflight };
}
