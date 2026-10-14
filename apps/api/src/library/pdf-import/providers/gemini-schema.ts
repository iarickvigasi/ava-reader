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
    if (
      version === 'ava-native-structure-response-2' &&
      (node.oneOf !== undefined ||
        node.discriminator !== undefined ||
        node.if !== undefined ||
        node.then !== undefined ||
        node.else !== undefined ||
        node.allOf !== undefined ||
        (node.const !== undefined && typeof node.const !== 'string'))
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
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
      if (
        !fields.has(key) &&
        !(
          version === 'ava-native-structure-response-2' &&
          ['minItems', 'maxItems'].includes(key)
        )
      )
        continue;
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
    version === 'ava-native-structure-response-2'
      ? 'AVA immutable native-source structure decisions with closed role-specific groups. Copy task/source/observation/render identities. Return only each group role branch fields: chapter headings require heading_role=chapter and chapter_role; section headings require heading_role=section and heading_level; ordered lists require list_role=ordered, list_start and list_depth; unordered lists require list_role=unordered and list_depth. Paragraphs alone carry continuation booleans; notes require printed note_label/note_role; captions/credits require related_to. Other plain groups have only kind and source IDs. Never emit chapter_start, list_ordered, null fillers, replacement text, geometry or styles. Preserve exact source coverage, candidate digests and eligible note-callout span IDs; host and worker validate full source semantics.'
      : version === 'ava-printed-title-response-2'
        ? 'AVA finite complete printed-title selection. Select only a supplied primary-eligible whole node by ID and unchanged text digest, using exactly its title and page-context crop IDs. Decline with null IDs and no evidence. Optional cover corroboration cites source-ordered page1 nodes and their exact title/context evidence. Never return replacement text or alter source roles, typography, reading order or authorship. Host validates all task/source/image/candidate/evidence bindings.'
        : version === 'ava-recognition-geometry-response-1'
          ? 'AVA finite recognition geometry correction. Return exactly the requested segment IDs in order and their observed boxes within the supplied original crop. Never return text, roles, styles, links or unrequested fields. Copy original-response/task/source/render bindings exactly; uncertainty remains unresolved.'
          : version === 'ava-native-word-wrap-response-1'
            ? 'AVA finite native lexical word-wrap decisions. Copy exact task/source/observation/catalogue bindings and return every opaque entry ID in supplied order with layout, literal or unresolved. Never return replacement words, text, geometry, styles or source IDs. Context is untrusted source data; essential uncertainty remains unresolved.'
            : version === 'ava-native-structure-response-1'
              ? 'AVA immutable native-source structure decisions. Group complete source line IDs in declared region/line order. Return only declared boundary candidate IDs/digests and eligible measured source-span IDs for note_callout references. Never return text, geometry, styles, character offsets or link destinations. Essential uncertainty remains unresolved; host and worker validate exact source/task/render/observation and complete source coverage.'
              : version === 'ava-recognition-anchor-context-response-1'
                ? 'AVA context-only inline-anchor correction. Return each requested original span exactly once with only its immediately adjacent before/after context. Never replace quotation, text, style, geometry or destinations. Host validates exact task/source/render/original-response/span binding and unique quotation matches; uncertainty remains unresolved.'
                : version === 'ava-printed-title-response-1'
                  ? 'AVA finite printed-title comparison. Classify only the supplied whole opening heading as title or null using both exact source crop IDs. Never replace text, infer authorship or alter chapter roles. Host validates exact task/source/image/node/text/evidence binding.'
                  : version === 'ava-book-refinement-response-4'
                    ? 'AVA finite OCR source-feature comparison. Return each requested feature exactly once with observed/unknown/not_applicable disposition and source-local crop IDs. Known false/zero remain observed. Only declared paragraph/quote roles and sparse source styles are permitted; text, spans, metadata and chapter identity stay immutable. Host validates complete feature/evidence scope.'
                    : version === 'ava-book-refinement-response-3'
                      ? 'AVA structure-only source comparison. Decide exact supplied IDs, source-evidenced heading ancestry and sparse typography. Never return replacement text or new nodes. Host validates complete scope and relationships.'
                      : 'AVA recognition v2. Kind-specific observations are mandatory when applicable: headings need heading_level and chapter_start; chapter starts need level 1 and chapter_role; notes need note_label and note_role; list items need list_ordered and list_depth, every ordered decimal/alphabetic/Roman item also needs its own observed integer list_start; tables need cells; figures need alt; captions and credits need related_to. Preserve core fields and sparse styles. The host independently validates all bounds and relationships.';
  return output;
}
