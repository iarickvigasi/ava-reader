import { exchangeReply } from './exchange-protocol';
import { encode } from './exchange-test-fixture';
import { wordWrapExchange } from './word-wrap-exchange-fixture';

it('requires the separately acknowledged word-wrap phase before artifacts', () => {
  const q = wordWrapExchange();
  q.page();
  q.refinement();
  expect(q.protocol.lastReply).toBe(false);
  q.batch(['wrap1']);
  expect(q.protocol.lastReply).toBe(false);
  const request = q.emit('word_wrap', { task_id: 'wrap1' });
  expect(q.protocol.lastReply).toBe(true);
  expect(() =>
    exchangeReply(encode({ ...request, payload: [{}] }), request),
  ).not.toThrow();
  expect(() =>
    exchangeReply(encode({ ...request, payload: [] }), request),
  ).toThrow('INVALID_RESULT');
  q.emit('artifacts', null);
});
it('acknowledges an empty complete catalogue before artifacts', () => {
  const q = wordWrapExchange();
  q.page();
  q.refinement();
  q.batch();
  expect(q.protocol.lastReply).toBe(true);
  q.emit('artifacts', null);
});
