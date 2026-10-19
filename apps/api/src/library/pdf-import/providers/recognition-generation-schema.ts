import { PdfProviderError } from './errors';
import { recognitionObservationSchema } from './recognition-observation-contract';
type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};
const scalarKeys = [
  'type',
  'description',
  'enum',
  'required',
  'minimum',
  'maximum',
  'minItems',
  'additionalProperties',
];
// A closed generation grammar, not the acceptance contract. One segment shape
// avoids repeating the entire style/cell/anchor tree for every kind. The full
// host contract still enforces kind-specific fields and source relationships.
// Gemini rejects this grammar with its large maxItems bounds. Keep those limits
// in host/worker validation, not the provider generation grammar.
export function recognitionGenerationSchema(): Schema {
  const source = recognitionObservationSchema();
  const definitions = record(source.$defs);
  function lower(value: unknown, seen: string[] = []): Schema {
    const node = record(value);
    if (
      ['oneOf', 'if', 'then', 'else', 'discriminator'].some((key) =>
        Object.hasOwn(node, key),
      )
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
    if (
      node.not !== undefined &&
      (node.title !== 'Style' ||
        JSON.stringify(node.not) !==
          JSON.stringify({ required: ['family', 'font_family_role'] }))
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
    if (typeof node.$ref === 'string') {
      const name = node.$ref.replace('#/$defs/', '');
      if (node.$ref !== `#/$defs/${name}` || seen.includes(name))
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
      return lower(definitions[name], [...seen, name]);
    }
    if (node.allOf !== undefined) {
      if (
        !Array.isArray(node.allOf) ||
        node.allOf.length !== 4 ||
        record(node.allOf[0]).title !== 'RecognitionSegment'
      )
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
      return lower(node.allOf[0], seen);
    }
    if (Array.isArray(node.anyOf)) {
      const alternatives = node.anyOf.map((part) => lower(part, seen));
      const present = alternatives.filter((part) => part.type !== 'null');
      if (
        alternatives.length !== 2 ||
        present.length !== 1 ||
        typeof present[0].type !== 'string'
      )
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
      const result: Schema = { ...present[0], type: [present[0].type, 'null'] };
      if (Array.isArray(result.enum))
        result.enum = [...(result.enum as unknown[]), null];
      return result;
    }
    const result: Schema = {};
    for (const key of scalarKeys)
      if (Object.hasOwn(node, key)) result[key] = structuredClone(node[key]);
    if (Object.hasOwn(node, 'const')) result.enum = [node.const];
    if (node.properties) {
      result.properties = Object.fromEntries(
        Object.entries(record(node.properties))
          // The finite legacy alias remains decoder-compatible; generation uses
          // the one canonical family spelling, never competing observations.
          .filter(
            ([key]) => node.title !== 'Style' || key !== 'font_family_role',
          )
          .map(([key, property]) => [key, lower(property, seen)]),
      );
      result.additionalProperties = false;
      if (node.title === 'RecognitionSegment') {
        // This observation is meaningful for every segment. Never guess a
        // missing chapter decision in the decoder after generation.
        result.required = [
          ...new Set([
            ...(node.required as string[]),
            'chapter_start',
            'chapter_role',
          ]),
        ];
        record(record(result.properties).chapter_start).description =
          'Required explicit decision: true only for a level 1 logical chapter heading with its observed chapter_role. False for section or inset headings and all non-heading segments.';
        record(record(result.properties).chapter_role).description =
          'Required explicit observation: frontmatter, bodymatter or backmatter for a true chapter_start at heading level 1; null for section/inset headings and non-heading segments. Never omit the field or guess a missing role in the decoder.';
      }
    }
    if (node.items) result.items = lower(node.items, seen);
    return result;
  }
  const result = lower(source);
  result.description =
    'AVA recognition observations. Use only declared property names. Styles are sparse: relative_size is the ratio to body size; never emit size or font_size. Preserve explicit false/zero. Each kind still requires its full observations: headings need heading_level/chapter_start, chapter starts chapter_role, ordered list items list_start, notes note_label/note_role, figures alt, tables cells, captions/credits related_to. Do not emit null for non-null optional fields. Full host and worker validation remains authoritative.';
  return result;
}
