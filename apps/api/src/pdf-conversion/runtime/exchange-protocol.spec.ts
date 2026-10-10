import { exchangeJson } from './exchange-json';
import {
  exchangeProtocol,
  exchangeReply,
  MAX_EXCHANGE_FRAME,
} from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';
const protocolForJob = () => exchangeProtocol(envelope());

it('rejects duplicate/escaped duplicate keys at every object depth and malformed UTF8', () => {
  for (const bytes of [
    Buffer.from('{"a":1,"\\u0061":2}'),
    Buffer.from('{"a":{"b":1,"b":2}}'),
    Buffer.from([0xff]),
  ])
    expect(() => exchangeJson(bytes)).toThrow('INVALID_RESULT');
  expect(
    exchangeJson(encode({ a: [{ x: 1 }, { x: 2 }], text: 'colon: "' })),
  ).toBeDefined();
});

it('accepts the full finite 500 pages, 25000 recognition tasks and 32 refinement tasks', () => {
  const protocol = protocolForJob();
  let seq = 0;
  for (let page = 1; page <= 500; page++) {
    const tasks = Array.from({ length: 50 }, (_, i) => ({
      task_id: `page-${page}-task-${i}`,
    }));
    protocol.accept(encode({ ...envelope(++seq), payload: { tasks } }));
    for (const task of tasks)
      protocol.accept(
        encode({ ...envelope(++seq, 'recognition'), payload: task }),
      );
  }
  const tasks = Array.from({ length: 32 }, (_, i) => ({
    task_id: `refine-${i}`,
  }));
  protocol.accept(
    encode({ ...envelope(++seq, 'refinement_batch'), payload: { tasks } }),
  );
  expect(protocol.lastReply).toBe(false);
  for (const task of tasks)
    protocol.accept(
      encode({ ...envelope(++seq, 'refinement'), payload: task }),
    );
  expect(protocol.lastReply).toBe(true);
  protocol.accept(encode(envelope(++seq, 'artifacts')));
  expect(seq).toBe(25534);
  expect(() => protocol.accept(encode(envelope(++seq)))).toThrow(
    'INVALID_RESULT',
  );
});

it.each([
  { ...envelope(), sequence: 2 },
  { ...envelope(), extra: true },
  { ...envelope(), source_sha256: 'invalid' },
  envelope(1, 'artifacts'),
  envelope(1, 'refinement'),
  envelope(1, 'refinement_batch'),
  envelope(1, 'recognition'),
])('refuses invalid first control', (value) => {
  expect(() => protocolForJob().accept(encode(value))).toThrow();
});

it('refuses changed binding, reordered phases, page overflow and frame-size overflow', () => {
  const protocol = protocolForJob();
  protocol.accept(encode(envelope()));
  expect(() =>
    protocol.accept(encode({ ...envelope(2), source_sha256: 'b'.repeat(64) })),
  ).toThrow('SOURCE_MISMATCH');
  protocol.accept(encode(envelope(2, 'refinement_batch')));
  expect(() => protocol.accept(encode(envelope(3)))).toThrow('INVALID_RESULT');
  const pages = protocolForJob();
  for (let i = 1; i <= 500; i++) pages.accept(encode(envelope(i)));
  expect(() => pages.accept(encode(envelope(501)))).toThrow('INVALID_RESULT');
  expect(() =>
    protocolForJob().accept(
      encode({ ...envelope(), payload: 'x'.repeat(MAX_EXCHANGE_FRAME) }),
    ),
  ).toThrow('RESOURCE_LIMIT');
});

it('requires advertised task order and completion before the next phase', () => {
  const protocol = protocolForJob();
  protocol.accept(
    encode({
      ...envelope(),
      payload: { tasks: [{ task_id: 'first' }, { task_id: 'second' }] },
    }),
  );
  for (const value of [
    envelope(2),
    envelope(2, 'refinement_batch'),
    envelope(2, 'artifacts'),
    { ...envelope(2, 'recognition'), payload: { task_id: 'second' } },
  ])
    expect(() => protocol.accept(encode(value))).toThrow('INVALID_RESULT');
  protocol.accept(
    encode({ ...envelope(2, 'recognition'), payload: { task_id: 'first' } }),
  );
  protocol.accept(
    encode({ ...envelope(3, 'recognition'), payload: { task_id: 'second' } }),
  );
  protocol.accept(
    encode({
      ...envelope(4, 'refinement_batch'),
      payload: { tasks: [{ task_id: 'refine' }] },
    }),
  );
  expect(() => protocol.accept(encode(envelope(5, 'artifacts')))).toThrow(
    'INVALID_RESULT',
  );
  protocol.accept(
    encode({ ...envelope(5, 'refinement'), payload: { task_id: 'refine' } }),
  );
  protocol.accept(encode(envelope(6, 'artifacts')));
});

it('requires empty batch acknowledgements and exactly one task response', () => {
  for (const kind of [
    'page',
    'refinement_batch',
    'recognition',
    'refinement',
  ] as const) {
    const request = envelope(1, kind),
      expected = kind === 'page' || kind === 'refinement_batch' ? 0 : 1;
    for (const count of [0, 1, 2]) {
      const run = () =>
        exchangeReply(
          encode({
            ...request,
            payload: Array.from({ length: count }, () => ({})),
          }),
          request,
        );
      if (count === expected) expect(run).not.toThrow();
      else expect(run).toThrow('INVALID_RESULT');
    }
  }
});

it('bounds and binds host replies without accepting changed task phase or non-list payloads', () => {
  const request = envelope();
  const reply = encode({ ...request, payload: [] });
  expect(exchangeReply(reply, request).readUInt32BE()).toBe(reply.length);
  for (const changed of [
    { ...request, payload: {} },
    { ...request, sequence: 2, payload: [] },
    { ...request, kind: 'refinement', payload: [] },
  ])
    expect(() => exchangeReply(encode(changed), request)).toThrow(
      'INVALID_RESULT',
    );
});
