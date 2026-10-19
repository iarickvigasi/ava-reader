import { PdfProviderError } from './errors';

type Schema = Record<string, unknown>;
type Node = {
  id: string;
  kind: string;
  structure_candidate?: boolean;
  body_reference_id: string | null;
};
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};

export function ocrBodyReferenceIds(
  nodes: readonly Node[],
): ReadonlySet<string> {
  const references = new Set(
    nodes.flatMap((node) =>
      node.body_reference_id ? [node.body_reference_id] : [],
    ),
  );
  return new Set(
    nodes
      .filter(
        (node) =>
          node.kind === 'paragraph' &&
          !node.structure_candidate &&
          references.has(node.id),
      )
      .map((node) => node.id),
  );
}

// A local body reference defines unit size. Enforce that known value during
// generation; never repair a returned answer or relax installed acceptance.
export function bodyReferenceGenerationBranches(
  branch: Schema,
  ids: string[],
  bodyReferences: ReadonlySet<string>,
): Schema[] {
  return [false, true].flatMap((baseline) => {
    const members = ids.filter((id) => bodyReferences.has(id) === baseline);
    if (!members.length) return [];
    const output = structuredClone(branch),
      fields = record(output.properties);
    record(fields.node_id).enum = members;
    if (baseline) {
      const style = record(fields.style);
      record(record(style.properties).relative_size).enum = [1];
      output.description =
        (typeof output.description === 'string' ? output.description : '') +
        ' These listed paragraphs are the local body references: relative_size is exactly 1 by definition, never an estimated ratio.';
    }
    return [output];
  });
}
