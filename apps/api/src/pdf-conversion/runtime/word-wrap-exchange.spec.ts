import { exchangeProtocol } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';
import { wordWrapExchange } from './word-wrap-exchange-fixture';

it.each([
  'early',
  'before-refinement-completion',
  'duplicate',
  'order',
  'oversized',
  'unfinished',
  'old-page',
  'old-marker',
])('refuses invalid word-wrap phase %s', (change) => {
  const q = wordWrapExchange();
  if (change === 'old-page') {
    expect(() =>
      q.emit('page', { schema_version: 'ava-prepare-result-3', tasks: [] }),
    ).toThrow('INVALID_RESULT');
    return;
  }
  if (change === 'old-marker') {
    expect(() =>
      q.emit(
        'page',
        { schema_version: 'ava-prepare-result-4', tasks: [] },
        'ava-reconstruction-exchange-1',
      ),
    ).toThrow('INVALID_RESULT');
    return;
  }
  q.page();
  if (change === 'early') {
    expect(() => q.batch()).toThrow('INVALID_RESULT');
    return;
  }
  if (change === 'before-refinement-completion') {
    q.emit('refinement_batch', { tasks: [{ task_id: 'r' }] });
    expect(() => q.batch()).toThrow('INVALID_RESULT');
    return;
  }
  q.refinement();
  if (change === 'oversized') {
    expect(() =>
      q.batch(Array.from({ length: 33 }, (_, i) => 'w' + i)),
    ).toThrow('INVALID_RESULT');
    return;
  }
  if (change === 'duplicate') {
    expect(() => q.batch(['w', 'w'])).toThrow('INVALID_RESULT');
    return;
  }
  q.batch(['w1', 'w2']);
  if (change === 'order')
    expect(() => q.emit('word_wrap', { task_id: 'w2' })).toThrow(
      'INVALID_RESULT',
    );
  if (change === 'unfinished')
    expect(() => q.emit('artifacts', null)).toThrow('INVALID_RESULT');
});
it('keeps new generic controls closed for historical streams and old namespaces', () => {
  expect(() =>
    exchangeProtocol(envelope()).accept(
      encode({
        ...envelope(),
        schema_version: 'ava-reconstruction-exchange-2',
      }),
    ),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    exchangeProtocol(envelope()).accept(
      encode({
        ...envelope(),
        payload: { schema_version: 'ava-prepare-result-4', tasks: [] },
      }),
    ),
  ).toThrow('INVALID_RESULT');
  const q = wordWrapExchange();
  q.page();
  q.refinement();
  q.batch(['w']);
  expect(() =>
    q.emit('word_wrap', { task_id: 'w' }, 'ava-native-structure-exchange-1'),
  ).toThrow('INVALID_RESULT');
});
