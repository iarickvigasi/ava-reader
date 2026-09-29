import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePacket } from './validate-packet';
import { response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
const parse = (segment: unknown) =>
  parsePacket(
    'RecognitionResponse',
    Buffer.from(JSON.stringify({ ...response, segments: [segment] })),
    100000,
  );

it.each([
  { kind: 'heading', heading_level: null },
  { kind: 'note', note_label: '1', note_role: null },
  { kind: 'note', note_label: '', note_role: 'footnote' },
  { kind: 'list_item', list_ordered: null, list_depth: 1 },
  { kind: 'list_item', list_ordered: true, list_depth: 1, list_start: null },
  { kind: 'table', cells: [] },
  { kind: 'paragraph', chapter_start: true, chapter_role: 'bodymatter' },
  {
    kind: 'heading',
    heading_level: 2,
    chapter_start: true,
    chapter_role: 'bodymatter',
  },
  { box: { ...wireSegment.box, coordinate_space: 'page_points_top_left' } },
  { box: { ...wireSegment.box, x1: 1001 } },
])(
  'JSON schema refuses conditional contract failure before semantic subprocess: %p',
  (change) => {
    expect(() => parse({ ...wireSegment, ...change })).toThrow(
      'INVALID_RESULT',
    );
  },
);

it.each(['style', 'spans', 'continues_to_next'])(
  'requires an explicit observation for %s',
  (field) => {
    const segment: Record<string, unknown> = { ...wireSegment };
    delete segment[field];
    expect(() => parse(segment)).toThrow('INVALID_RESULT');
  },
);

it.each([
  {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
    chapter_role: 'bodymatter',
  },
  { kind: 'heading', heading_level: 2 },
  { kind: 'note', note_label: '1', note_role: 'footnote' },
  { kind: 'list_item', list_ordered: true, list_start: 3, list_depth: 1 },
  { kind: 'furniture', text: 'Print page 1' },
  { style: { id: 'reset', bold: false, indent_em: 0 } },
])(
  'accepts complete authored observation with sparse visible semantics: %p',
  (change) => {
    const segment = { ...wireSegment, ...change };
    expect(parse(segment).segments[0]).toEqual(segment);
  },
);

it('rejects the exact settled v1 response without repairing coordinates or missing fields', () => {
  const bytes = readFileSync(
    resolve(
      __dirname,
      '../../../../../packages/pdf-epub/tests/reconstruction_v2/fixtures/rejected-provider-v1.json',
    ),
  );
  expect(() => parsePacket('RecognitionResponse', bytes, 100000)).toThrow(
    'INVALID_RESULT',
  );
});
