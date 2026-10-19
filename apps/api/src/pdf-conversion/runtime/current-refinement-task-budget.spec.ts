import { recognitionSchemas } from '../reconstruction/generated/schemas';
import {
  CURRENT_REFINEMENT_TASK_LIMIT,
  HISTORICAL_REFINEMENT_TASK_LIMIT,
} from './refinement-frame-budget';
import { exchangeProtocol } from './exchange-protocol';
import { continuationTask } from '../reconstruction/continuation-fixture';

function setup(captured = true) {
  const binding = {
    source_sha256: continuationTask.source_sha256,
    profile_id: continuationTask.profile_id,
  };
  const protocol = exchangeProtocol(binding, true, true, true, captured);
  let sequence = 0;
  const emit = (kind: string, payload: unknown) =>
    protocol.accept(
      Buffer.from(
        JSON.stringify({
          ...binding,
          schema_version: 'ava-reconstruction-exchange-2',
          sequence: ++sequence,
          kind,
          payload,
        }),
      ),
    );
  emit('page', { schema_version: 'ava-prepare-result-5', tasks: [] });
  return { protocol, emit };
}
const batch = (count: number, current = true) => ({
  schema_version: current
    ? 'ava-book-refinement-batch-4'
    : 'ava-book-refinement-batch-3',
  ...(current
    ? { source_continuation_policy: 'ava-source-continuation-presentation-1' }
    : {}),
  tasks: Array.from({ length: count }, (_, i) => ({
    ...continuationTask,
    task_id: `refine-budget-${i}`,
  })),
});
it.each([48, 64])(
  'accepts a current %s-task batch and every ordered task through transport counters',
  (count) => {
    const { emit, protocol } = setup();
    emit('refinement_batch', batch(count));
    for (let i = 0; i < count; i++)
      emit('refinement', { task_id: `refine-budget-${i}` });
    emit('word_wrap_batch', {
      schema_version: 'ava-native-word-wrap-batch-1',
      tasks: [],
    });
    expect(protocol.lastReply).toBe(true);
    expect(() => emit('artifacts', null)).not.toThrow();
  },
);
it('refuses task65 before accepting the batch', () => {
  expect(() => setup().emit('refinement_batch', batch(65))).toThrow(
    'INVALID_RESULT',
  );
});
it('does not lend current capacity to an older batch marker', () => {
  expect(() => setup().emit('refinement_batch', batch(33, false))).toThrow(
    'INVALID_RESULT',
  );
});

it('does not lend current capacity without captured continuation admission', () => {
  expect(() => setup(false).emit('refinement_batch', batch(33))).toThrow(
    'INVALID_RESULT',
  );
});
it('does not lend current capacity to a foreign continuation policy', () => {
  expect(() =>
    setup().emit('refinement_batch', {
      ...batch(33),
      source_continuation_policy: 'foreign',
    }),
  ).toThrow('INVALID_RESULT');
});

it('matches the generated current and historical count ceilings', () => {
  expect(CURRENT_REFINEMENT_TASK_LIMIT).toBe(
    recognitionSchemas.ContinuationRefinementBatch.properties.tasks.maxItems,
  );
  expect(CURRENT_REFINEMENT_TASK_LIMIT).toBe(
    recognitionSchemas.ContinuationReconstructionInput.properties.refinements
      .maxItems,
  );
  expect(HISTORICAL_REFINEMENT_TASK_LIMIT).toBe(
    recognitionSchemas.FrontmatterTitleRefinementBatch.properties.tasks
      .maxItems,
  );
});
