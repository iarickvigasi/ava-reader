import { PdfProviderError } from './errors';
import { recoveredRefinementGenerationTask } from './refinement-generation-task';
import { geminiRecognitionSchema } from './gemini-schema';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import type { ProviderTask } from './types';

type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};

// Source-derived candidates are finite generation choices. The installed worker
// still checks exact candidate/evidence coverage and the positive visual decision.
export function continuationGenerationSchema(
  schema: Schema,
  task: ProviderTask,
): Schema {
  const source = recoveredRefinementGenerationTask(task);
  if (source.schema_version !== 'ava-book-refinement-task-5')
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  const output = structuredClone(schema);
  const legacy = geminiRecognitionSchema(
    recognitionSchemas.BookRefinementResponse,
    'ava-book-refinement-response-3',
  );
  const variants = record(
    record(record(legacy.properties).decisions).items,
  ).anyOf;
  if (!Array.isArray(variants) || variants.length !== 2)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const nativeEndpoints = new Set(source.native_endpoints);
  const delegateIds = new Set(
    source.join_candidates
      .flatMap((c) => [c.previous_id, c.next_id])
      .filter((id) => !nativeEndpoints.has(id)),
  );
  const nodes = new Map(source.nodes.map((n) => [n.id, n]));
  const branches: Schema[] = [];
  for (const mode of ['native', 'ocr', 'delegated'] as const) {
    const ids = source.decision_ids.filter((id) => {
      const native = nodes.get(id)?.structure_candidate ?? false;
      return mode === 'native'
        ? native
        : !native && delegateIds.has(id) === (mode === 'delegated');
    });
    if (!ids.length) continue;
    const branch = structuredClone(record(variants[mode === 'native' ? 0 : 1]));
    const fields = record(branch.properties);
    record(fields.node_id).enum = ids;
    if (mode === 'delegated')
      fields.style = { anyOf: [fields.style, { type: 'null' }] };
    branch.description =
      mode === 'native'
        ? 'Only listed native role candidates: keep measured style null.'
        : mode === 'delegated'
          ? 'Listed OCR endpoints: role_kind null; style null only with the matching selected, fully evidenced uniform presentation candidate and join true. Otherwise return observed source style.'
          : 'Listed OCR decisions: role_kind null and observed source style required.';
    branches.push(branch);
  }
  const fields = record(output.properties);
  if (branches.length)
    record(fields.decisions).items =
      branches.length === 1 ? branches[0] : { anyOf: branches };
  const choice = record(record(fields.presentations).items);
  const choices = source.join_candidates.map((candidate) => {
    const branch = structuredClone(choice);
    const properties = record(branch.properties);
    properties.edge_id = { type: 'string', enum: [candidate.edge_id] };
    properties.candidate_id = {
      anyOf: [{ type: 'string', enum: [candidate.id] }, { type: 'null' }],
    };
    return branch;
  });
  record(fields.presentations).items =
    choices.length === 1 ? choices[0] : { anyOf: choices };
  output.description =
    'AVA source-bound continuation comparison. Use exact supplied candidate and crop IDs; positive uniform presentation requires matching join true. Null OCR style is allowed only for selected candidate endpoints. No replacement text or guessed metrics. Full canonical and installed semantic validation remains authoritative.';
  return output;
}
