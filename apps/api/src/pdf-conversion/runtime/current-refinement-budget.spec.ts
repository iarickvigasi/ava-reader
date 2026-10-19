import { currentRefinementMode } from './refinement-frame-budget';
import { exchangeProtocol, MAX_EXCHANGE_FRAME } from './exchange-protocol';
import { encode, envelope } from './exchange-test-fixture';
import { MAX_CURRENT_REFINEMENT_FRAME } from './refinement-frame-budget';

const batch = (extra = {}) => ({
  schema_version: 'ava-book-refinement-batch-4',
  source_continuation_policy: 'ava-source-continuation-presentation-1',
  tasks: [],
  pixels: 'x'.repeat(25 * 1024 ** 2),
  ...extra,
});
const protocol = (current = true) =>
  exchangeProtocol(envelope(), true, true, true, current);
const page = () => ({
  ...envelope(),
  schema_version: 'ava-reconstruction-exchange-2',
  payload: { schema_version: 'ava-prepare-result-5', tasks: [] },
});
const review = (payload: unknown) => ({
  ...envelope(2, 'refinement_batch'),
  schema_version: 'ava-reconstruction-exchange-2',
  payload,
});

it('admits one 25MiB current refinement while retaining exact phase limits', () => {
  const p = protocol();
  p.accept(encode(page()));
  expect(p.accept(encode(review(batch()))).kind).toBe('refinement_batch');
  expect(() => p.accept(encode(review(batch())))).toThrow('INVALID_RESULT');
});
it.each([
  [false, {}],
  [true, { schema_version: 'ava-book-refinement-batch-3' }],
  [true, { source_continuation_policy: 'wrong' }],
])('keeps legacy or mismatched batch at 24MiB', (current, changes) => {
  const p = protocol(current);
  p.accept(encode(page()));
  expect(() => p.accept(encode(review(batch(changes))))).toThrow(
    'RESOURCE_LIMIT',
  );
});
it('keeps a finite 64MiB current frame and rejects incompatible admission modes', () => {
  expect(MAX_EXCHANGE_FRAME).toBe(24 * 1024 ** 2 + 1024);
  expect(MAX_CURRENT_REFINEMENT_FRAME).toBe(64 * 1024 ** 2 + 1024);
  expect(() =>
    protocol().accept(Buffer.alloc(MAX_CURRENT_REFINEMENT_FRAME + 1)),
  ).toThrow('RESOURCE_LIMIT');
  expect(() => exchangeProtocol(envelope(), false, false, false, true)).toThrow(
    'DISPATCH_NOT_AUTHORIZED',
  );
});
it.each([
  'word_wrap_batch',
  'anchor_context',
  'anchor_quote',
  'geometry',
  'page',
  'refinement',
  'refusal',
] as const)('does not expand the existing %s ceiling', (kind) => {
  const value = {
    ...envelope(2, kind),
    schema_version:
      kind === 'geometry'
        ? 'ava-recognition-geometry-exchange-1'
        : kind === 'anchor_context'
          ? 'ava-recognition-anchor-context-exchange-1'
          : kind === 'anchor_quote'
            ? 'ava-recognition-anchor-quote-exchange-2'
            : 'ava-reconstruction-exchange-2',
    payload: batch(),
  };
  const p = protocol();
  p.accept(encode(page()));
  expect(() => p.accept(encode(value))).toThrow('RESOURCE_LIMIT');
});

it('does not spend the envelope margin on an oversized current payload', () => {
  const payload = {
    schema_version: 'ava-book-refinement-batch-4',
    source_continuation_policy: 'ava-source-continuation-presentation-1',
    tasks: [],
    pixels: '',
  };
  payload.pixels = 'x'.repeat(
    64 * 1024 ** 2 - Buffer.byteLength(JSON.stringify(payload)) + 1,
  );
  const bytes = encode(review(payload));
  expect(bytes.length).toBeLessThan(MAX_CURRENT_REFINEMENT_FRAME);
  const p = protocol();
  p.accept(encode(page()));
  expect(() => p.accept(bytes)).toThrow('RESOURCE_LIMIT');
});

it('requires every captured current policy before enlarging a domain frame', () => {
  const policies = {
    sourceLayoutPolicy: 'ava-native-layout-1',
    sourceStructurePolicy: 'ava-native-structure-2',
    sourceNormalizationPolicy: 'ava-native-word-wrap-1',
    recognitionRepairPolicy: 'ava-recognition-geometry-repair-2',
    sourceTitlePolicy: 'ava-frontmatter-title-1',
    sourceContinuationPolicy: 'ava-source-continuation-presentation-1',
  };
  expect(currentRefinementMode(policies)).toBe(true);
  for (const key of Object.keys(policies)) {
    expect(currentRefinementMode({ ...policies, [key]: undefined })).toBe(
      false,
    );
    expect(currentRefinementMode({ ...policies, [key]: 'old' })).toBe(false);
  }
});
