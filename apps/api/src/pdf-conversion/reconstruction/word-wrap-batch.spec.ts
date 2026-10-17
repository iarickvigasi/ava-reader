import { wordWrapBatch } from './word-wrap-batch';
import { wrapBatch } from './word-wrap-fixture';
import { nativeAttempt } from './native-structure-attempt-fixture';

const context = () => ({
  ...nativeAttempt().context,
  sourceNormalizationPolicy: 'ava-native-word-wrap-1' as const,
});
it('binds requested chunks to complete source catalogue and census before dispatch', () =>
  expect(wordWrapBatch(wrapBatch, context())).toEqual(wrapBatch));
it.each([
  'source',
  'profile',
  'policy',
  'census-hash',
  'catalogue',
  'observation',
  'order',
  'ghost',
  'missing',
  'changed-context',
])('refuses catalogue mismatch %s', (change) => {
  const value = structuredClone(wrapBatch);
  if (change === 'source') value.source_sha256 = 'f'.repeat(64);
  if (change === 'profile') value.profile_id = 'ava-pdf-prose-en-uk-v3';
  if (change === 'policy') {
    expect(() => wordWrapBatch(value, nativeAttempt().context)).toThrow(
      'SOURCE_MISMATCH',
    );
    return;
  }
  if (change === 'census-hash') value.census_sha256 = 'f'.repeat(64);
  if (change === 'catalogue') value.tasks[0].catalogue_sha256 = 'f'.repeat(64);
  if (change === 'observation')
    value.tasks[0].observation_sha256 = 'f'.repeat(64);
  if (change === 'order') value.tasks.reverse();
  if (change === 'ghost') value.tasks[0].entries[0].id = 'w99999';
  if (change === 'missing') value.tasks.pop();
  if (change === 'changed-context')
    value.tasks[0].entries[0].context = 'invented context';
  expect(() => wordWrapBatch(value, context())).toThrow();
});
