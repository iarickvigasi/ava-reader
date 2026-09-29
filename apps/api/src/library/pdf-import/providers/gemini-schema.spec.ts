import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';
const canonical = recognitionSchemas.RecognitionResponse;
const lowered = geminiRecognitionSchema(canonical);
const validate = new Ajv2020({ strict: true }).compile(lowered);
const packet = (change = {}) => ({
  ...response,
  segments: [{ ...wireSegment, ...change }],
});
it('inlines refs and removes unsupported composition without mutating the canonical contract', () => {
  const before = JSON.stringify(canonical);
  expect(geminiRecognitionSchema(canonical)).toEqual(lowered);
  expect(JSON.stringify(canonical)).toBe(before);
  expect(JSON.stringify(lowered)).not.toMatch(
    /"(?:allOf|\$ref|\$defs|const|maxItems|maxLength|pattern)":/,
  );
});
it.each([
  {},
  { kind: 'heading', heading_level: 2 },
  {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
    chapter_role: 'bodymatter',
  },
  { kind: 'note', note_label: '1', note_role: 'footnote' },
  { kind: 'list_item', list_ordered: true, list_start: 0, list_depth: 1 },
  { style: { id: 'reset', bold: false, indent_em: 0 } },
])('preserves valid authored output %p', (change) => {
  expect(validate(packet(change))).toBe(true);
  expect(validatePacket('RecognitionResponse', packet(change))).toEqual(
    packet(change),
  );
});
it.each([
  { kind: 'heading', heading_level: null },
  { kind: 'note', note_label: '1', note_role: null },
  { kind: 'list_item', list_ordered: true, list_depth: 1, list_start: null },
  { kind: 'table', cells: [] },
  { kind: 'paragraph', chapter_start: true, chapter_role: 'bodymatter' },
])('keeps relaxed grammar separate from strict host refusal %p', (change) => {
  expect(validate(packet(change))).toBe(true);
  expect(() => validatePacket('RecognitionResponse', packet(change))).toThrow(
    'INVALID_RESULT',
  );
});
it.each([
  { box: { ...wireSegment.box, x1: 1001 } },
  { kind: 'invented' },
  { method: 'native' },
  { text: 17 },
  { surprise: true },
])('retains simple grammar constraints %p', (change) =>
  expect(validate(packet(change))).toBe(false),
);
it('refuses unknown composition instead of silently weakening a future contract', () => {
  expect(() =>
    geminiRecognitionSchema({ $defs: {}, allOf: [{ type: 'object' }] }),
  ).toThrow();
});
