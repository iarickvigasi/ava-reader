import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { titleTask, titleResponse } from './frontmatter-title-fixture';
import { wrapBatch } from './word-wrap-fixture';
import { checksumBuffer } from '../../shared/blob-utils';

export function titleAttempt(captured = true) {
  const controller = new AbortController();
  const dispatch = jest.fn<
    ReturnType<AttemptContext['deps']['dispatch']>,
    Parameters<AttemptContext['deps']['dispatch']>
  >(() => Promise.resolve({ output: JSON.stringify(titleResponse) }));
  const validateFrontmatterTitle = jest.fn(() => Promise.resolve());
  const context: AttemptContext = {
    sourceSha256: titleTask.source_sha256,
    profileId: titleTask.profile_id,
    pageLimit: titleTask.source_page_count,
    providerMode: 'live',
    sourceLayoutPolicy: 'ava-native-layout-1',
    sourceStructurePolicy: 'ava-native-structure-1',
    sourceNormalizationPolicy: 'ava-native-word-wrap-1',
    recognitionRepairPolicy: 'ava-recognition-geometry-repair-1',
    ...(captured ? { sourceTitlePolicy: 'ava-frontmatter-title-1' } : {}),
    validateFrontmatterTitle,
    checkActive: (signal) => {
      if (signal.aborted) throw new Error('aborted');
    },
    deps: {
      dispatch,
      progress: jest.fn(() => Promise.resolve()),
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
          schema_version: 'ava-reconstruction-exchange-2',
          sequence: ++sequence,
          source_sha256: context.sourceSha256,
          profile_id: context.profileId,
          kind,
          payload,
        }),
      ),
      controller.signal,
    );
  const pages = async () => {
    for (
      let page_number = 1;
      page_number <= titleTask.source_page_count;
      page_number++
    )
      await send('page', {
        schema_version: 'ava-prepare-result-4',
        profile_id: context.profileId,
        source_sha256: context.sourceSha256,
        source_layout_policy: context.sourceLayoutPolicy,
        source_structure_policy: context.sourceStructurePolicy,
        source_normalization_policy: context.sourceNormalizationPolicy,
        source_page_count: titleTask.source_page_count,
        page_number,
        observation_sha256: 'a'.repeat(64),
        native_segment_count: 0,
        tasks: [],
      });
  };
  const batch = {
    schema_version: 'ava-book-refinement-batch-3',
    source_sha256: context.sourceSha256,
    source_title_policy: 'ava-frontmatter-title-1',
    tasks: [titleTask],
  };
  const empty = checksumBuffer(Buffer.from('[]'));
  const wraps = {
    ...wrapBatch,
    profile_id: context.profileId,
    entries: [],
    census: [],
    tasks: [],
    catalogue_sha256: empty,
    census_sha256: empty,
  };
  return {
    context,
    state,
    dispatch,
    send,
    pages,
    batch,
    wraps,
    controller,
    validateFrontmatterTitle,
  };
}
