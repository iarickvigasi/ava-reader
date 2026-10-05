import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from './generated/schemas';
import { response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
import { validatePacket } from './validate-packet';
import { geminiRecognitionSchema } from '../../library/pdf-import/providers/gemini-schema';
import { anchorProperties, properties } from './text-style-schema-fixture';

it('preserves authoritative text and anchor descriptions in Gemini generation grammar', () => {
  const canonical = recognitionSchemas.RecognitionResponse;
  const retained = JSON.stringify(canonical);
  const lowered = geminiRecognitionSchema(canonical);
  const segment = properties(lowered).segments.items!;
  const cell = properties(segment).cells.items!.items!;
  expect(anchorProperties(segment)).toMatchObject({
    exact_text: {
      description:
        canonical.$defs.RecognitionTextAnchor.properties.exact_text.description,
    },
    before: {
      description:
        canonical.$defs.RecognitionTextAnchor.properties.before.description,
    },
    after: {
      description:
        canonical.$defs.RecognitionTextAnchor.properties.after.description,
    },
  });
  expect(anchorProperties(cell)).toEqual(anchorProperties(segment));
  expect(properties(segment).text.description).toBe(
    canonical.$defs.RecognitionSegment.allOf[0].properties!.text.description,
  );
  expect(properties(cell).text.description).toBe(
    canonical.$defs.RecognitionCell.properties.text.description,
  );
  expect(JSON.stringify(canonical)).toBe(retained);
});

it('keeps cross-field quotation matching outside provider JSON grammar', () => {
  // The exact worker refusal of this mismatch is covered by the Python regression fixture.
  // JSON Schema alone cannot compare an anchor string to its owning sibling text.
  const malformed = {
    ...response,
    segments: [
      {
        ...wireSegment,
        text: 'x₂',
        spans: [
          {
            anchor: { exact_text: '2' },
            style: { id: 'lowered', vertical_align: 'sub' },
            note_label: null,
            target_text: null,
            url: null,
          },
        ],
      },
    ],
  };
  const check = new Ajv2020({ strict: true }).compile(
    geminiRecognitionSchema(recognitionSchemas.RecognitionResponse),
  );
  expect(check(malformed)).toBe(true);
  expect(validatePacket('RecognitionResponse', malformed)).toEqual(malformed);
});
