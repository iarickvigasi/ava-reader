import { PdfProviderError } from './errors';
type Schema = Record<string, unknown>;
const fields = new Set([
  'type',
  'properties',
  'required',
  'items',
  'anyOf',
  'enum',
  'minimum',
  'maximum',
  'additionalProperties',
  'description',
]);
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};
// Generation grammar only. Full canonical JSON Schema and Python checks remain authoritative.
export function geminiRecognitionSchema(
  input: Schema,
  version = 'ava-recognition-response-2',
): Schema {
  const definitions = record(input.$defs);
  function lower(value: unknown, references: string[] = []): Schema {
    let node = record(value);
    if (typeof node.$ref === 'string') {
      const name = node.$ref.replace('#/$defs/', '');
      if (node.$ref !== `#/$defs/${name}` || references.includes(name))
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
      return lower(definitions[name], [...references, name]);
    }
    if (node.allOf !== undefined) {
      const branches = node.allOf;
      if (
        !Array.isArray(branches) ||
        record(branches[0]).title !== 'RecognitionSegment'
      )
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
      node = record(branches[0]);
    }
    const output: Schema = {};
    const recognitionSegment = node.title === 'RecognitionSegment';
    for (const [key, child] of Object.entries(node)) {
      if (!fields.has(key)) continue;
      if (key === 'properties')
        output[key] = Object.fromEntries(
          Object.entries(record(child)).map(([name, property]) => [
            name,
            lower(property, references),
          ]),
        );
      else if (key === 'items') output[key] = lower(child, references);
      else if (key === 'anyOf' && Array.isArray(child))
        output[key] = child.map((branch) => lower(branch, references));
      else output[key] = structuredClone(child);
    }
    if (recognitionSegment) {
      // Gemini lacks the host's allOf kind requirements. Make this inexpensive boolean
      // explicit for every segment so non-chapter headings cannot omit their observation.
      output.required = [
        ...new Set([...(node.required as string[]), 'chapter_start']),
      ];
      const properties = record(output.properties);
      record(properties.list_ordered).description =
        'For list_item: true for decimal, alphabetic or Roman ordered markers; false for bullets. Null for other kinds.';
      record(properties.list_start).description =
        'Every ordered item needs its own observed integer ordinal, including nested and continued items: a/b=1/2, i/ii=1/2, IV/V=4/5. Preserve the printed marker in text. Null for unordered items and other kinds. An unreadable essential marker belongs in unresolved.';
    }
    if (typeof node.const === 'string') output.enum = [node.const];
    return output;
  }
  const output = lower(input);
  output.description =
    version === 'ava-book-refinement-response-3'
      ? 'AVA structure-only source comparison. Decide exact supplied IDs, source-evidenced heading ancestry and sparse typography. Never return replacement text or new nodes. Host validates complete scope and relationships.'
      : 'AVA recognition v2. Kind-specific observations are mandatory when applicable: headings need heading_level and chapter_start; chapter starts need level 1 and chapter_role; notes need note_label and note_role; list items need list_ordered and list_depth, every ordered decimal/alphabetic/Roman item also needs its own observed integer list_start; tables need cells; figures need alt; captions and credits need related_to. Preserve core fields and sparse styles. The host independently validates all bounds and relationships.';
  return output;
}
