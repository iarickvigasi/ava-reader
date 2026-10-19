import { PdfProviderError } from './errors';
type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};

// Each choice stands alone: Gemini must not recover required fields from siblings
// of anyOf. Group identical kind contracts, and expand cell definitions only once.
export function recognitionSegmentGrammar(
  segment: Schema,
  kindBranches: Schema[],
): Schema {
  const properties = record(segment.properties);
  const kinds = record(properties.kind).enum as string[];
  const groups = new Map<string, { kinds: string[]; schema: Schema }>();
  const seen = new Set<string>();
  for (const branch of kindBranches) {
    const overrides = record(branch.properties);
    const branchKinds = record(overrides.kind).enum as string[];
    if (
      !Array.isArray(branchKinds) ||
      branchKinds.some((kind) => !kinds.includes(kind) || seen.has(kind))
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
    for (const kind of branchKinds) seen.add(kind);
    const conditions = { ...overrides };
    delete conditions.kind;
    const key = JSON.stringify([conditions, branch.required]);
    const group = groups.get(key);
    if (group) group.kinds.push(...branchKinds);
    else groups.set(key, { kinds: [...branchKinds], schema: branch });
  }
  if (seen.size !== kinds.length || groups.size !== 7)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return {
    anyOf: [...groups.values()].map(({ kinds, schema }) => {
      const variant = structuredClone(segment);
      const fields = record(variant.properties);
      for (const [name, condition] of Object.entries(
        record(schema.properties),
      )) {
        if (name === 'kind' || name === 'cells') continue;
        // A non-null kind observation replaces its nullable base alternative.
        const description = record(fields[name]).description;
        fields[name] = {
          ...(typeof description === 'string' ? { description } : {}),
          type: 'string',
          ...record(condition),
        };
      }
      fields.kind = { type: 'string', enum: kinds };
      fields.cells = kinds.includes('table')
        ? {
            ...record(fields.cells),
            minItems: 1,
            items: { ...record(record(fields.cells).items), maxItems: 8 },
          }
        : { type: 'array', items: { type: 'object' }, maxItems: 0 };
      const { kind, ...observations } = fields;
      variant.properties = { kind, ...observations };
      variant.required = [
        ...new Set([
          ...(segment.required as string[]),
          ...(schema.required as string[]),
        ]),
      ];
      return variant;
    }),
  };
}
