import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { capsParent, capsOriginal, capsResponse } from './small-caps-fixture';

export function smallCapsAttemptFixture(current = true, denied = false) {
  const dispatch = jest
    .fn<
      ReturnType<AttemptContext['deps']['dispatch']>,
      Parameters<AttemptContext['deps']['dispatch']>
    >()
    .mockResolvedValueOnce({ output: JSON.stringify(capsOriginal) })
    .mockResolvedValue({ output: JSON.stringify(capsResponse) });
  const preflight = jest.fn(() =>
    denied ? Promise.reject(new Error('denied')) : Promise.resolve(),
  );
  const state = attemptExchanges({
    sourceSha256: capsParent.source_sha256,
    profileId: capsParent.profile_id,
    providerMode: 'live',
    pageLimit: 500,
    sourceLayoutPolicy: 'ava-native-layout-1',
    recognitionRepairPolicy: 'ava-recognition-geometry-repair-2',
    ...(current
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
            kind === 'anchor_quote'
              ? 'ava-recognition-anchor-quote-exchange-2'
              : 'ava-reconstruction-exchange-1',
          sequence: ++sequence,
          source_sha256: capsParent.source_sha256,
          profile_id: capsParent.profile_id,
          kind,
          payload,
        }),
      ),
      new AbortController().signal,
    );
  const page = () =>
    send('page', {
      schema_version: 'ava-prepare-result-2',
      source_layout_policy: 'ava-native-layout-1',
      source_sha256: capsParent.source_sha256,
      source_page_count: 1,
      page_number: 1,
      profile_id: capsParent.profile_id,
      observation_sha256: 'b'.repeat(64),
      native_segment_count: 0,
      tasks: [capsParent],
    });
  return { send, page, dispatch, preflight };
}
