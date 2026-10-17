import { attemptExchanges } from './attempt-exchanges';
import type { AttemptContext } from './attempt-provider';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { continuationTask, continuationResponse } from './continuation-fixture';
import { titleAttempt } from './frontmatter-attempt-fixture';
import { SOURCE_CONTINUATION_POLICY } from '../../library/pdf-import/admission/profile';

function setup(captured = true) {
  const base = titleAttempt();
  const context: AttemptContext = {
    ...base.context,
    sourceSha256: continuationTask.source_sha256,
    profileId: continuationTask.profile_id,
    sourceStructurePolicy: 'ava-native-structure-2',
    recognitionRepairPolicy: 'ava-recognition-geometry-repair-2',
    sourceContinuationPolicy: captured ? SOURCE_CONTINUATION_POLICY : undefined,
    validateContinuation: jest.fn(() => Promise.resolve()),
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
      new AbortController().signal,
    );
  const pages = async () => {
    for (let number = 1; number <= 2; number++)
      await send('page', {
        schema_version: 'ava-prepare-result-5',
        source_layout_policy: context.sourceLayoutPolicy,
        source_structure_policy: context.sourceStructurePolicy,
        source_normalization_policy: context.sourceNormalizationPolicy,
        source_sha256: context.sourceSha256,
        profile_id: context.profileId,
        source_page_count: 2,
        page_number: number,
        observation_sha256: continuationTask.observation_sha256,
        native_segment_count: 0,
        tasks: [],
      });
  };
  const batch = {
    schema_version: 'ava-book-refinement-batch-4',
    source_sha256: context.sourceSha256,
    source_title_policy: context.sourceTitlePolicy,
    source_continuation_policy: SOURCE_CONTINUATION_POLICY,
    tasks: [continuationTask],
  };
  base.dispatch.mockResolvedValue({
    output: JSON.stringify(continuationResponse),
  });
  return {
    context,
    state,
    send,
    pages,
    batch,
    dispatch: base.dispatch,
    wraps: {
      ...base.wraps,
      source_sha256: context.sourceSha256,
      profile_id: context.profileId,
    },
  };
}
it('crosses pages, captured Batch4, original Response5 and word-wrap controls exactly once', async () => {
  const q = setup();
  await q.pages();
  await q.send('refinement_batch', q.batch);
  const response = JSON.parse(
    (
      await q.send('refinement', { task_id: continuationTask.task_id })
    ).toString(),
  ) as ExchangeEnvelope;
  expect(response.payload).toEqual([continuationResponse]);
  await q.send('word_wrap_batch', q.wraps);
  await q.send('artifacts', null);
  expect(q.state.finish(0)).toEqual({ pageCount: 2, taskCount: 0 });
  expect(q.dispatch).toHaveBeenCalledTimes(1);
  expect(q.context.validateContinuation).toHaveBeenCalledTimes(2);
});
it.each(['uncaptured', 'historical-batch', 'wrong-policy'])(
  'refuses %s before dispatch',
  async (change) => {
    const q = setup(change !== 'uncaptured');
    await q.pages();
    const batch: Record<string, unknown> = { ...q.batch };
    if (change === 'historical-batch') {
      batch.schema_version = 'ava-book-refinement-batch-3';
      delete batch.source_continuation_policy;
      batch.tasks = [];
    }
    if (change === 'wrong-policy') batch.source_continuation_policy = 'foreign';
    await expect(q.send('refinement_batch', batch)).rejects.toThrow();
    expect(q.dispatch).not.toHaveBeenCalled();
  },
);
