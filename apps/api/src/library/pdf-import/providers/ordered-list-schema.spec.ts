import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { validatePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import { geminiRecognitionSchema } from './gemini-schema';
const check = new Ajv2020({ strict: true }).compile(
  geminiRecognitionSchema(recognitionSchemas.RecognitionResponse),
);
const item = (id: string, text: string, ordinal: number | null, depth = 1) => ({
  ...wireSegment,
  id,
  text,
  kind: 'list_item',
  list_ordered: true,
  list_start: ordinal,
  list_depth: depth,
});
it('keeps actual nested-alpha failure semantics strict without rewriting the raw response', () => {
  const raw = {
    ...response,
    segments: [
      item('s1', '1. Prepare the telescope.', 1),
      item('s2', 'a. Check the lens.', null, 2),
      item('s3', 'b. Keep the cloth dry.', null, 2),
      item('s4', '2. Open the notebook.', 2),
    ],
  };
  const before = JSON.stringify(raw);
  // Vertex's supported projection cannot discriminate nullable fields by a boolean.
  expect(check(raw)).toBe(true);
  expect(() => validatePacket('RecognitionResponse', raw)).toThrow(
    'INVALID_RESULT',
  );
  expect(JSON.stringify(raw)).toBe(before);
});
it.each(
  [
    [
      item('s1', '1. Prepare.', 1),
      item('s2', 'a. Check.', 1, 2),
      item('s3', 'b. Close.', 2, 2),
    ],
    [item('s1', 'iv) Continue.', 4), item('s2', 'v) Continue.', 5)],
    [{ ...item('s1', '• Unordered.', null), list_ordered: false }],
    [{ ...wireSegment, id: 's1', text: 'Ordinary prose.' }],
    [
      {
        ...wireSegment,
        id: 's1',
        kind: 'note',
        note_label: '1',
        note_role: 'footnote',
      },
    ],
  ].map((segments) => ({ segments })),
)(
  'accepts observed ordinals and legitimate nulls without changing other kinds %p',
  ({ segments }) => {
    const raw = { ...response, segments };
    expect(check(raw)).toBe(true);
    expect(validatePacket('RecognitionResponse', raw)).toEqual(raw);
  },
);
