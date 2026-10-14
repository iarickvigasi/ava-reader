import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';

const grammar = geminiRecognitionSchema(recognitionSchemas.RecognitionResponse);
const check = new Ajv2020({ strict: true }).compile(grammar);
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
  'accepts valid authored %s output without expanding shared fields',
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
    if (kind !== 'table')
      expect(check(packet([withoutCells(segment)]))).toBe(true);
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
