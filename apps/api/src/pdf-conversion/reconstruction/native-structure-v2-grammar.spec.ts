import Ajv from 'ajv';
import { nativeResponse2 } from './native-structure-v2-fixture';
import { recognitionSchemas } from './generated/schemas';
import { validatePacket } from './validate-packet';
import { geminiRecognitionSchema } from '../../library/pdf-import/providers/gemini-schema';

const version = 'ava-native-structure-response-2';
const grammar = geminiRecognitionSchema(
  recognitionSchemas.NativeStructureResponse2,
  version,
);
const accepts = new Ajv({ strict: false }).compile(grammar);
const common = { id: 'group', region_id: 'body', line_ids: ['line'] };
const variants = [
  { kind: 'heading', heading_role: 'chapter', chapter_role: 'bodymatter' },
  { kind: 'heading', heading_role: 'section', heading_level: 2 },
  {
    kind: 'paragraph',
    continues_from_previous: false,
    continues_to_next: false,
  },
  { kind: 'note', note_label: '1', note_role: 'footnote' },
  { kind: 'list_item', list_role: 'ordered', list_start: 1, list_depth: 1 },
  { kind: 'list_item', list_role: 'unordered', list_depth: 1 },
  { kind: 'caption', related_to: null },
  { kind: 'furniture' },
];
const packet = (group: object) => ({
  ...nativeResponse2,
  groups: [{ ...common, ...group }],
});

it.each(variants)(
  'accepts a complete closed role branch in canonical and provider grammars: %j',
  (group) => {
    const value = packet(group);
    expect(validatePacket('NativeStructureResponse2', value)).toEqual(value);
    expect(accepts(value)).toBe(true);
  },
);

it.each([
  { ...variants[7], chapter_role: 'bodymatter' },
  { ...variants[2], chapter_role: null },
  { ...variants[2], heading_level: null },
  { ...variants[2], chapter_start: false },
  { ...variants[2], note_label: null },
  { ...variants[2], list_role: 'unordered' },
  { ...variants[2], related_to: null },
  { kind: 'paragraph' },
  { kind: 'heading', heading_role: 'chapter' },
  { ...variants[0], heading_level: 1 },
  { ...variants[0], heading_level: 2 },
  { ...variants[0], chapter_start: false },
  { ...variants[1], chapter_role: 'bodymatter' },
  { ...variants[1], chapter_start: true },
  { kind: 'heading', heading_role: 'section' },
  { ...variants[1], heading_level: 7 },
  { kind: 'note', note_label: '1' },
  { kind: 'list_item', list_role: 'ordered', list_depth: 1 },
  { ...variants[4], list_start: null },
  { ...variants[4], list_start: -1 },
  { ...variants[5], list_start: null },
  { ...variants[5], list_ordered: false },
  { kind: 'caption' },
  { ...variants[7], continues_to_next: false },
  { ...variants[7], text: 'replacement' },
])(
  'refuses contradictory, missing and unrelated role fields in both grammars: %j',
  (group) => {
    const value = packet(group);
    expect(() => validatePacket('NativeStructureResponse2', value)).toThrow(
      'INVALID_RESULT',
    );
    expect(accepts(value)).toBe(false);
  },
);

it.each(['oneOf', 'discriminator', 'if', 'then', 'else', 'allOf'])(
  'refuses unsupported %s instead of dropping Native2 grammar authority',
  (key) => {
    const schema = {
      ...recognitionSchemas.NativeStructureResponse2,
      [key]: {},
    };
    expect(() => geminiRecognitionSchema(schema, version)).toThrow(
      'PDF_PROVIDER_REQUEST_INVALID',
    );
  },
);

it.each([true, false, 1])(
  'refuses unsupported scalar const %j in Native2',
  (value) => {
    expect(() =>
      geminiRecognitionSchema(
        { ...recognitionSchemas.NativeStructureResponse2, const: value },
        version,
      ),
    ).toThrow('PDF_PROVIDER_REQUEST_INVALID');
  },
);
