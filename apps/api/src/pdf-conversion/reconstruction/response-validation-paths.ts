import { recognitionSchemas } from './generated/schemas';

export const validationKeywords = [
  'type',
  'required',
  'enum',
  'const',
  'additionalProperties',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'multipleOf',
] as const;
const fields = new Set<string>();
const schemaNames = new Set<string>();
type RequirementRule = {
  properties?: Record<
    string,
    { [key: string]: unknown; const?: unknown; enum?: unknown[] } | undefined
  >;
  required?: string[];
};
// Only the segment contract owns these requirements. Recursive collection mixes
// unconditional kind fields with conditional chapter/list alternatives.
const segmentContract =
  recognitionSchemas.RecognitionResponse.$defs.RecognitionSegment;
const [core, ...conditions] = segmentContract.allOf;
const rules: RequirementRule[] = [
  { required: core.required },
  ...conditions.flatMap<RequirementRule>((condition) => condition.anyOf ?? []),
];
function applies(rule: RequirementRule, segment: Record<string, unknown>) {
  return ['kind', 'chapter_start', 'list_ordered'].every((key) => {
    const constraint = rule.properties?.[key];
    if (!constraint) return true;
    if (!Object.hasOwn(segment, key)) return false;
    if (Object.hasOwn(constraint, 'const'))
      return segment[key] === constraint.const;
    return !constraint.enum || constraint.enum.includes(segment[key]);
  });
}
function collect(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const node = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(node)) {
    if (child && typeof child === 'object') {
      if (key === 'properties')
        Object.keys(child).forEach((name) => fields.add(name));
      if (key === '$defs')
        Object.keys(child).forEach((name) => schemaNames.add(name));
      collect(child);
    }
  }
}
collect(recognitionSchemas.RecognitionResponse);
const schemaTokens = new Set<string>([
  ...validationKeywords,
  ...fields,
  ...schemaNames,
  'properties',
  '$defs',
  'items',
]);
export const responseField = (name: string) => fields.has(name);
export const schemaToken = (name: string) => schemaTokens.has(name);
// JSON pointer tokens retain only canonical schema names and bounded numeric indices.
export function validationPath(
  value: string,
  schema: boolean,
): (string | number)[] | undefined {
  const prefix = schema ? '#' : '';
  if (value === prefix) return [];
  if (value.length > 256 || !value.startsWith(prefix + '/')) return undefined;
  const allowed = schema ? schemaTokens : fields;
  const parts = value.slice(prefix.length + 1).split('/');
  if (
    parts.some(
      (part) => !allowed.has(part) && !/^(?:0|[1-9][0-9]{0,4})$/.test(part),
    )
  )
    return undefined;
  return parts.map((part) => (allowed.has(part) ? part : Number(part)));
}
export function matchingKindRequiredFields(value: unknown) {
  const missing: { instancePath: (string | number)[]; field: string }[] = [];
  if (!value || typeof value !== 'object')
    return { fields: missing, complete: true };
  const segments = (value as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) return { fields: missing, complete: true };
  for (const [index, raw] of segments.entries()) {
    const segment: unknown = raw;
    if (!segment || typeof segment !== 'object' || index > 99999) continue;
    const kind = (segment as { kind?: unknown }).kind;
    if (typeof kind !== 'string') continue;
    const required = new Set(
      rules
        .filter((rule) => applies(rule, segment as Record<string, unknown>))
        .flatMap((rule) => rule.required ?? []),
    );
    for (const field of required)
      if (fields.has(field) && !Object.hasOwn(segment, field)) {
        if (missing.length === 16) return { fields: missing, complete: false };
        missing.push({ instancePath: ['segments', index], field });
      }
  }
  return { fields: missing, complete: true };
}
