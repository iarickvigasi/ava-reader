import { exchangeProtocol, exchangeReply } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';

const correction = (sequence = 3, parent = 'parent') => ({
  ...envelope(sequence),
  schema_version: 'ava-recognition-anchor-context-exchange-1',
  kind: 'anchor_context',
  payload: { task_id: 'context-only', original_task_id: parent },
});
function pendingParent() {
  const protocol = exchangeProtocol(envelope());
  protocol.accept(
    encode({ ...envelope(1), payload: { tasks: [{ task_id: 'parent' }] } }),
  );
  protocol.accept(
    encode({ ...envelope(2, 'recognition'), payload: { task_id: 'parent' } }),
  );
  return protocol;
}

it('accepts one distinct context-only exchange immediately after its recognition reply', () => {
  const protocol = pendingParent();
  const request = protocol.accept(encode(correction()));
  const bytes = encode({ ...request, payload: [{ outcome: 'corrected' }] });
  expect(exchangeReply(bytes, request).readUInt32BE()).toBe(bytes.length);
  expect(() => protocol.accept(encode(correction(4)))).toThrow(
    'INVALID_RESULT',
  );
});

it.each([
  { ...correction(), schema_version: 'ava-reconstruction-exchange-1' },
  { ...correction(), kind: 'recognition' },
  correction(3, 'foreign-parent'),
  { ...correction(), payload: { task_id: 'context-only' } },
])(
  'refuses changed correction schema/kind/parent before accepting another round',
  (value) => {
    expect(() => pendingParent().accept(encode(value))).toThrow(
      'INVALID_RESULT',
    );
  },
);

it('refuses a correction before recognition, after the next page, and after refinement starts', () => {
  const initial = exchangeProtocol(envelope());
  expect(() => initial.accept(encode(correction(1)))).toThrow('INVALID_RESULT');
  const nextPage = pendingParent();
  nextPage.accept(encode(envelope(3)));
  expect(() => nextPage.accept(encode(correction(4)))).toThrow(
    'INVALID_RESULT',
  );
  const refinement = pendingParent();
  refinement.accept(encode(envelope(3, 'refinement_batch')));
  expect(() => refinement.accept(encode(correction(4)))).toThrow(
    'INVALID_RESULT',
  );
});

it('keeps source binding, strict sequence and exact one-response acknowledgement', () => {
  expect(() =>
    pendingParent().accept(
      encode({ ...correction(), source_sha256: 'b'.repeat(64) }),
    ),
  ).toThrow('SOURCE_MISMATCH');
  expect(() => pendingParent().accept(encode(correction(4)))).toThrow(
    'INVALID_RESULT',
  );
  const request = pendingParent().accept(encode(correction()));
  for (const payload of [[], [{}, {}]])
    expect(() =>
      exchangeReply(encode({ ...request, payload }), request),
    ).toThrow('INVALID_RESULT');
});

const quoteCorrection = (sequence = 3) => ({
  ...correction(sequence),
  schema_version: 'ava-recognition-anchor-quote-exchange-2',
  kind: 'anchor_quote',
});
it('binds quote schema/kind and shares one repair opportunity in both directions', () => {
  for (const first of [correction(), quoteCorrection()]) {
    for (const second of [correction(4), quoteCorrection(4)]) {
      const protocol = pendingParent();
      const request = protocol.accept(encode(first));
      const bytes = encode({ ...request, payload: [{}] });
      expect(exchangeReply(bytes, request).readUInt32BE()).toBe(bytes.length);
      expect(() => protocol.accept(encode(second))).toThrow('INVALID_RESULT');
    }
  }
  for (const changed of [
    { ...quoteCorrection(), kind: 'anchor_context' },
    { ...correction(), kind: 'anchor_quote' },
  ])
    expect(() => pendingParent().accept(encode(changed))).toThrow(
      'INVALID_RESULT',
    );
});
