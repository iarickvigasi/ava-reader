import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';

const grammar = geminiRecognitionSchema(recognitionSchemas.RecognitionResponse);
const check = new Ajv2020({ strict: true }).compile(grammar);
const variants = (grammar.properties as Record<string, Record<string, unknown>>)
  .segments.items as { anyOf: Record<string, unknown>[] };
const branchChecks = variants.anyOf.map((branch) =>
  new Ajv2020({ strict: true }).compile(branch),
);
const cell = {
  text: 'One',
  box: wireSegment.box,
  style: null,
  header_axis: null,
  spans: [],
};
const table = { ...wireSegment, id: 's0002', kind: 'table', cells: [[cell]] };
const packet = (segments: unknown[]) => ({ ...response, segments });
const withoutCells = (segment: Record<string, unknown>) => {
  const value = { ...segment };
  delete value.cells;
  return value;
};

it('refuses the authored two-segment missing-table-cells failure shape', () => {
  // Match the retained failure's shape, with authored text and identities only.
  const raw = packet([
    {
      ...wireSegment,
      kind: 'heading',
      heading_level: 2,
      text: 'Contents',
    },
    withoutCells({ ...table, text: 'Left | Right\nOne | Two' }),
  ]);
  const before = JSON.stringify(raw);
  expect(check(raw)).toBe(false);
  expect(() => validatePacket('RecognitionResponse', raw)).toThrow(
    'INVALID_RESULT',
  );
  expect(JSON.stringify(raw)).toBe(before);
});

it.each([withoutCells(table), { ...table, cells: [] }])(
  'refuses missing or empty table cells before generation',
  (segment) => expect(check(packet([segment]))).toBe(false),
);

it('refuses the cells-only failure shape in every isolated choice', () => {
  const raw = packet([{ cells: [] }]);
  expect(check(raw)).toBe(false);
  expect(() => validatePacket('RecognitionResponse', raw)).toThrow(
    'INVALID_RESULT',
  );
  expect(branchChecks.every((validate) => !validate(raw.segments[0]))).toBe(
    true,
  );
});

it.each([
  'id',
  'page',
  'box',
  'kind',
  'text',
  'style',
  'spans',
  'method',
  'continues_from_previous',
  'continues_to_next',
  'chapter_start',
])('requires %s inside every isolated choice', (field) => {
  expect(variants.anyOf).toHaveLength(7);
  expect(variants).not.toHaveProperty('properties');
  expect(variants).not.toHaveProperty('required');
  for (const branch of variants.anyOf) {
    expect(branch.additionalProperties).toBe(false);
    expect(Object.keys(branch.properties as object)[0]).toBe('kind');
    expect(branch.required).toContain(field);
    expect(branch.properties).toHaveProperty(field);
  }
  const incomplete: Record<string, unknown> = { ...wireSegment };
  delete incomplete[field];
  expect(check(packet([incomplete]))).toBe(false);
  expect(branchChecks.every((validate) => !validate(incomplete))).toBe(true);
});

it.each([
  'paragraph',
  'heading',
  'quote',
  'aside',
  'caption',
  'credit',
  'verse',
  'code',
  'list_item',
  'note',
  'figure',
  'table',
  'separator',
  'furniture',
  'unsupported',
])(
  'accepts valid authored %s output through a self-contained choice',
  (kind) => {
    const segment = {
      ...wireSegment,
      kind,
      ...(kind === 'heading' ? { heading_level: 2 } : {}),
      ...(kind === 'note' ? { note_label: '1', note_role: 'footnote' } : {}),
      ...(kind === 'list_item' ? { list_ordered: false, list_depth: 1 } : {}),
      ...(['caption', 'credit'].includes(kind) ? { related_to: 's0002' } : {}),
      ...(kind === 'table' ? { cells: [[cell]] } : {}),
    };
    const raw = packet([segment]);
    expect(check(raw)).toBe(true);
    expect(validatePacket('RecognitionResponse', raw)).toEqual(raw);
    expect(branchChecks.filter((validate) => validate(segment))).toHaveLength(
      1,
    );
    if (kind !== 'table')
      expect(check(packet([withoutCells(segment)]))).toBe(true);
  },
);

it.each([
  ['heading', 'heading_level'],
  ['note', 'note_label'],
  ['note', 'note_role'],
  ['list_item', 'list_ordered'],
  ['list_item', 'list_depth'],
  ['table', 'cells'],
  ['figure', 'alt'],
  ['caption', 'related_to'],
  ['credit', 'related_to'],
])('requires the %s observation %s in the chosen branch', (kind, field) => {
  const incomplete: Record<string, unknown> = {
    ...wireSegment,
    kind,
    heading_level: 2,
    note_label: '1',
    note_role: 'footnote',
    list_ordered: false,
    list_depth: 1,
    cells: kind === 'table' ? [[cell]] : [],
  };
  delete incomplete[field];
  expect(check(packet([incomplete]))).toBe(false);
  expect(branchChecks.every((validate) => !validate(incomplete))).toBe(true);
  expect(() =>
    validatePacket('RecognitionResponse', packet([incomplete])),
  ).toThrow('INVALID_RESULT');
});

it.each([
  { kind: 'heading', heading_level: null },
  { kind: 'note', note_label: null, note_role: 'footnote' },
  { kind: 'note', note_label: '1', note_role: null },
  { kind: 'list_item', list_ordered: null, list_depth: 1 },
  { kind: 'list_item', list_ordered: false, list_depth: null },
])('refuses non-observations for kind fields %p', (change) => {
  const segment = { ...wireSegment, ...change };
  expect(check(packet([segment]))).toBe(false);
  expect(branchChecks.every((validate) => !validate(segment))).toBe(true);
});

it.each([
  { kind: 'paragraph', chapter_start: true, chapter_role: 'bodymatter' },
  {
    kind: 'heading',
    heading_level: 2,
    chapter_start: true,
    chapter_role: 'bodymatter',
  },
  {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
    chapter_role: null,
  },
  { kind: 'paragraph', list_ordered: true, list_start: 1 },
  { kind: 'list_item', list_ordered: true, list_depth: 1, list_start: null },
])(
  'keeps boolean cross-field implications authoritative in the host %p',
  (change) => {
    const raw = packet([{ ...wireSegment, ...change }]);
    expect(check(raw)).toBe(true);
    expect(() => validatePacket('RecognitionResponse', raw)).toThrow(
      'INVALID_RESULT',
    );
    expect(JSON.stringify(grammar)).not.toMatch(/"enum":\[(?:true|false|null)/);
  },
);

it('keeps cells empty on non-table kinds and retains cell field validation', () => {
  expect(check(packet([{ ...wireSegment, cells: [[cell]] }]))).toBe(false);
  expect(check(packet([{ ...table, cells: [[{ text: 'Incomplete' }]] }]))).toBe(
    false,
  );
});

it('preserves wire-valid empty origin rows for the host grid checks', () => {
  // A row covered by a prior vertical span has no new physical cell origins.
  for (const cells of [[[]], [[cell], []], [[{ ...cell, row_span: 2 }], []]]) {
    const raw = packet([{ ...table, cells }]);
    expect(check(raw)).toBe(true);
    expect(validatePacket('RecognitionResponse', raw)).toEqual(raw);
  }
  // Generation shape cannot prove rectangular coverage; Python/source checks do.
});
