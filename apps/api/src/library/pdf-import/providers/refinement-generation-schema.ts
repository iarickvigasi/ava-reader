import { PdfProviderError } from './errors';
import { recoveredRefinementGenerationTask } from './refinement-generation-task';
import { bibliographicGenerationSchema } from './bibliographic-generation-schema';
import type { ProviderTask } from './types';

type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};
// Bind each existing branch to its source-owned decision IDs. This is generation
// guidance only: canonical response parsing and installed acceptance stay unchanged.
export function refinementGenerationSchema(
  schema: Schema,
  task: ProviderTask,
): Schema {
  const recovered = recoveredRefinementGenerationTask(task);
  const byId = new Map(recovered.nodes.map((node) => [node.id, node]));
  const nodes = recovered.decision_ids.map((id) => byId.get(id)!);
  const output = structuredClone(schema);
  bibliographicGenerationSchema(output, recovered.metadata_ids ?? []);
  const decisions = record(record(output.properties).decisions);
  const variants = record(decisions.items).anyOf;
  if (!Array.isArray(variants) || variants.length !== 2)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const native = record(variants[0]),
    ocr = record(variants[1]);
  const nativeFields = record(native.properties),
    ocrFields = record(ocr.properties);
  if (
    record(nativeFields.style).type !== 'null' ||
    record(nativeFields.role_kind).type !== 'string' ||
    record(ocrFields.style).type !== 'object' ||
    record(ocrFields.role_kind).type !== 'null'
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  // Metadata-only tasks have no structure decisions; keep that array unchanged.
  // The metadata branches above still require complete selected source ranges.
  if (!nodes.length) return output;
  const branches: Schema[] = [];
  for (const [branch, fields, isNative] of [
    [native, nativeFields, true],
    [ocr, ocrFields, false],
  ] as const) {
    const ids = nodes
      .filter((node) => (node.structure_candidate ?? false) === isNative)
      .map((node) => node.id);
    if (!ids.length) continue;
    record(fields.node_id).enum = ids;
    branch.description = isNative
      ? 'Only the listed native structure candidates: classify role_kind, keep style null and measured source typography unchanged.'
      : 'Only the listed OCR decisions: role_kind is null; style requires id observed, relative_size and explicit bold from source pixels.';
    branches.push(branch);
  }
  decisions.items = branches.length === 1 ? branches[0] : { anyOf: branches };
  return output;
}
