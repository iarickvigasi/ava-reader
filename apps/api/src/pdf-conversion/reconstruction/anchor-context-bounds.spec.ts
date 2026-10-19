import { safeEventSchema } from '../../library/pdf-import/reports/event-contract';
import { observeAnchorContextProjection } from './observe-anchor-context-projection';
import type { AttemptContext } from './attempt-provider';
import { boundedContextFixture } from './anchor-context-bounds-fixture';
import { anchorContextResponse } from './anchor-context-response';
import { parsePacket } from './validate-packet';
import { contextSha } from './anchor-context-binding';
import type { AnchorRepairTask } from './anchor-repair-types';

const apply = (
  f: ReturnType<typeof boundedContextFixture>,
  output = JSON.stringify(f.response),
) => anchorContextResponse(f.task, output, f.parent, f.original);

it.each([
  [129, 0],
  [0, 129],
  [129, 229],
  [4096, 4096],
])(
  'bounds literal context %s/%s without changing content or the raw receipt',
  (b, a) => {
    const f = boundedContextFixture('L'.repeat(b), 'R'.repeat(a));
    const original = JSON.stringify(f.original),
      raw = JSON.stringify(f.response);
    expect(() =>
      parsePacket(
        'RecognitionAnchorContextResponse',
        Buffer.from(raw),
        2 * 1024 ** 2,
      ),
    ).toThrow('INVALID_RESULT');
    const result = apply(f, raw);
    expect(result.response.patches[0]).toMatchObject({
      before: 'L'.repeat(Math.min(b, 128)),
      after: 'R'.repeat(Math.min(a, 128)),
    });
    expect(result).toHaveProperty(
      'projection.rawResponseSha256',
      contextSha(raw),
    );
    expect(result).toHaveProperty(
      'projection.derivedResponseSha256',
      contextSha(JSON.stringify(result.response)),
    );
    expect(result).toHaveProperty('projection.slots.0.codePointStart', b);
    const restored = structuredClone(result.corrected!);
    restored.segments[0].spans[0].anchor =
      f.original.segments[0].spans[0].anchor;
    expect(restored).toEqual(f.original);
    expect(JSON.stringify(f.original)).toBe(original);
    expect(JSON.stringify(f.response)).toBe(raw);
  },
);
it('keeps ordinary exact-128 replies byte-equivalent and without a projection', () => {
  const f = boundedContextFixture('L'.repeat(128), 'R'.repeat(128));
  expect(apply(f).response).toEqual(f.response);
  expect(apply(f)).not.toHaveProperty('projection');
});
it('clips by Unicode scalars and records code-point rather than UTF-16 positions', () => {
  const f = boundedContextFixture('😀'.repeat(129), '🎈'.repeat(129));
  const r = apply(f);
  expect(r.response.patches[0].before).toBe('😀'.repeat(128));
  expect(r.response.patches[0].after).toBe('🎈'.repeat(128));
  expect(r).toHaveProperty('projection.slots.0.codePointStart', 129);
});
it('can choose a later repeated word using exact two-sided context', () => {
  const f = boundedContextFixture('x|' + 'L'.repeat(129), 'R'.repeat(130));
  expect(apply(f)).toHaveProperty('projection.slots.0.codePointStart', 131);
});
it('keeps actual newlines literal and refuses an invented escaped-newline locator', () => {
  const f = boundedContextFixture('L'.repeat(129) + '\n', 'R'.repeat(129));
  expect(apply(f).response.patches[0].before.endsWith('\n')).toBe(true);
  f.response.patches[0].before = 'L'.repeat(129) + String.raw`\n`;
  expect(() => apply(f)).toThrow('INVALID_RESULT');
});
it.each(['before', 'after'] as const)(
  'refuses contradictory discarded %s text even when the shortened locator matches',
  (key) => {
    const f = boundedContextFixture();
    f.response.patches[0][key] =
      key === 'before' ? 'Z' + 'L'.repeat(128) : 'R'.repeat(128) + 'Z';
    expect(() => apply(f)).toThrow('INVALID_RESULT');
  },
);
it('refuses a full unique locator when shortening would create ambiguity', () => {
  const f = boundedContextFixture(
    'A' + 'L'.repeat(128),
    '',
    '|B' + 'L'.repeat(128) + 'x',
  );
  expect(() => apply(f)).toThrow('INVALID_RESULT');
});
it.each([
  'unknown-top',
  'unknown-patch',
  'wrong-type',
  'missing',
  'duplicate',
  'foreign-span',
  'foreign-slot',
  'quote',
  'style',
  'unresolved',
  'too-long-before',
  'too-long-after',
])('refuses %s alongside overlong metadata', (kind) => {
  const f = boundedContextFixture();
  const p = f.response.patches[0];
  if (kind === 'unknown-top') Object.assign(f.response, { unknown: true });
  if (kind === 'unknown-patch') Object.assign(p, { unknown: true });
  if (kind === 'wrong-type') Object.assign(p, { after: 9 });
  if (kind === 'missing') f.response.patches = [];
  if (kind === 'duplicate') f.response.patches.push({ ...p });
  if (kind === 'foreign-span') p.span_sha256 = 'f'.repeat(64);
  if (kind === 'foreign-slot') p.span_index++;
  if (kind === 'quote') Object.assign(p, { exact_text: 'changed' });
  if (kind === 'style') Object.assign(p, { style: { italic: true } });
  if (kind === 'unresolved') {
    f.response.outcome = 'unresolved';
    f.response.unresolved_reason = 'IMAGE_UNCLEAR';
  }
  if (kind === 'too-long-before') p.before = 'L'.repeat(4097);
  if (kind === 'too-long-after') p.after = 'R'.repeat(4097);
  expect(() => apply(f)).toThrow();
});
it.each([
  'task_id',
  'source_sha256',
  'render_sha256',
  'original_task_id',
  'original_response_sha256',
] as const)('preserves %s identity checks', (key) => {
  const f = boundedContextFixture();
  f.response[key] = 'f'.repeat(64);
  expect(() => apply(f)).toThrow('SOURCE_MISMATCH');
});
it('rejects original-response changes before deriving a projected reply', () => {
  const f = boundedContextFixture();
  f.original.segments[0].style = { id: 'foreign', italic: true };
  expect(() => apply(f)).toThrow('SOURCE_MISMATCH');
});
it.each([
  'ava-recognition-anchor-context-task-2',
  'ava-recognition-anchor-quote-task-2',
  'ava-recognition-anchor-quote-task-3',
])('does not extend %s', (schema_version) => {
  const f = boundedContextFixture();
  const task = { ...f.task, schema_version } as AnchorRepairTask;
  expect(() =>
    anchorContextResponse(
      task,
      JSON.stringify(f.response),
      f.parent,
      f.original,
    ),
  ).toThrow('INVALID_RESULT');
});
it.each([
  'duplicate-key',
  'escaped-duplicate-key',
  'literal-surrogate',
  'escaped-surrogate',
  'malformed',
  'raw-limit',
])('refuses %s before projection', (kind) => {
  const f = boundedContextFixture();
  let raw = JSON.stringify(f.response);
  if (kind === 'duplicate-key')
    raw = raw.replace('"before":', '"before":"fake","before":');
  if (kind === 'escaped-duplicate-key')
    raw = raw.replace('"before":', String.raw`"befo\u0072e":"fake","before":`);
  if (kind === 'literal-surrogate') raw = raw.replace('L', '\ud800');
  if (kind === 'escaped-surrogate') raw = raw.replace('L', String.raw`\ud800`);
  if (kind === 'malformed') raw = raw.slice(0, -1);
  if (kind === 'raw-limit') raw += ' '.repeat(2 * 1024 ** 2);
  expect(() => apply(f, raw)).toThrow();
});

it('retains only safe projection evidence and does not give an optional observer correction authority', () => {
  const f = boundedContextFixture();
  const result = apply(f);
  if (!('projection' in result) || !result.projection)
    throw new Error('missing projection');
  const emit = jest.fn();
  const context = {
    deps: { observer: { emit, nextUnit: () => 'projection-1' } },
  } as unknown as AttemptContext;
  observeAnchorContextProjection(f.task, result.projection, context);
  expect(emit).toHaveBeenCalledTimes(1);
  const [kind, stage, , details] = emit.mock.calls[0] as [
    string,
    string,
    string,
    object,
  ];
  const event = safeEventSchema.parse({ kind, stage, details });
  expect(event.details.anchorContextProjection).toEqual(result.projection);
  const unsafe = structuredClone(event);
  Object.assign(unsafe.details.anchorContextProjection!, {
    rawResponse: 'private source canary',
  });
  expect(() => safeEventSchema.parse(unsafe)).toThrow();
  emit.mockImplementation(() => {
    throw new Error('observer unavailable');
  });
  expect(() =>
    observeAnchorContextProjection(f.task, result.projection, context),
  ).not.toThrow();
  expect(apply(f).corrected).toEqual(result.corrected);
});
