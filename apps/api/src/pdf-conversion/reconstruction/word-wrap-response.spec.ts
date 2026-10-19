import { wordWrapResponse } from './word-wrap-response';
import { wrapTask, wrapResponses } from './word-wrap-fixture';

it('accepts complete ordered lexical dispositions without replacement text', () => {
  expect(wordWrapResponse(wrapTask, JSON.stringify(wrapResponses[0]))).toEqual(
    wrapResponses[0],
  );
  const uncertain = structuredClone(wrapResponses[0]);
  uncertain.decisions[0].disposition = 'unresolved';
  expect(
    wordWrapResponse(wrapTask, JSON.stringify(uncertain)).decisions[0]
      .disposition,
  ).toBe('unresolved');
});
it.each([
  'source',
  'task',
  'observation',
  'catalogue',
  'order',
  'duplicate',
  'foreign',
  'missing',
  'text',
  'offset',
])('refuses malformed lexical response %s', (change) => {
  const value = structuredClone(wrapResponses[0]);
  const extra: Record<string, unknown> = { ...value };
  if (change === 'source') value.source_sha256 = 'f'.repeat(64);
  if (change === 'task') value.task_id = 'foreign-task';
  if (change === 'observation') value.observation_sha256 = 'f'.repeat(64);
  if (change === 'catalogue') value.catalogue_sha256 = 'f'.repeat(64);
  if (change === 'order') value.decisions.reverse();
  if (change === 'duplicate') value.decisions[1] = { ...value.decisions[0] };
  if (change === 'foreign') value.decisions[0].id = 'w99999';
  if (change === 'missing') value.decisions.pop();
  if (change === 'text') extra.text = 'replacement';
  if (change === 'offset') extra.offset = 2;
  expect(() =>
    wordWrapResponse(
      wrapTask,
      JSON.stringify(['text', 'offset'].includes(change) ? extra : value),
    ),
  ).toThrow();
});
