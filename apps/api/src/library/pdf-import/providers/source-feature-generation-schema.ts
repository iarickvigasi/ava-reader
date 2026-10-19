import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { PdfProviderError } from './errors';
import { recoveredRefinementGenerationTask } from './refinement-generation-task';
import type { ProviderTask } from './types';

type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};

// Match the already-enforced worker Style contract during generation. This does
// not clamp model output, invent a margin, or change historical response parsing.
export function sourceFeatureGenerationSchema(
  schema: Schema,
  task: ProviderTask,
): Schema {
  const source = recoveredRefinementGenerationTask(task);
  if (source.schema_version !== 'ava-book-refinement-task-4')
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  const output = structuredClone(schema);
  const decision = record(
    record(record(output.properties).feature_decisions).items,
  );
  const fields = record(decision.properties);
  record(fields.node_id).enum = source.source_features.map((q) => q.node_id);
  const features = [
    ...new Set(source.source_features.flatMap((q) => q.requested_features)),
  ];
  const roles = [
    ...new Set(source.source_features.flatMap((q) => q.allowed_roles)),
  ];
  const featureArray = record(fields.features),
    item = record(featureArray.items);
  const properties = record(item.properties);
  const style = record(
    record(record(recognitionSchemas.SourceFeatureTask.$defs).Style).properties,
  );
  function observedStyle(field: string): Schema {
    const branches = record(style[field]).anyOf;
    if (!Array.isArray(branches) || branches.length !== 2)
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
    const nonNull = branches
      .map(record)
      .filter((branch) => branch.type !== 'null');
    if (
      nonNull.length !== 1 ||
      !branches.some((branch) => record(branch).type === 'null')
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
    return structuredClone(nonNull[0]);
  }
  const values: Record<string, Schema> = {
    family: observedStyle('family'),
    weight: observedStyle('bold'),
    italic: observedStyle('italic'),
    relative_size: observedStyle('relative_size'),
    first_line_indent: observedStyle('indent_em'),
    block_inset: observedStyle('block_indent_em'),
    paragraph_role: { type: 'string', enum: roles },
  };
  const observed = features.map((feature) => ({
    ...structuredClone(item),
    properties: {
      ...structuredClone(properties),
      feature: { type: 'string', enum: [feature] },
      disposition: { type: 'string', enum: ['observed'] },
      value: values[feature],
      reason: { type: 'null' },
    },
  }));
  const unknown = {
    ...structuredClone(item),
    properties: {
      ...structuredClone(properties),
      feature: { type: 'string', enum: features },
      disposition: { type: 'string', enum: ['unknown'] },
      value: { type: 'null' },
      reason: {
        type: 'string',
        enum: [
          'source_blurred',
          'source_clipped',
          'source_context_insufficient',
        ],
      },
    },
  };
  const branches: Schema[] = [...observed, unknown];
  if (
    source.source_features.some(
      (q) =>
        q.requested_features.includes('first_line_indent') &&
        source.nodes.find((n) => n.id === q.node_id)?.kind === 'heading',
    )
  )
    branches.push({
      ...structuredClone(item),
      properties: {
        ...structuredClone(properties),
        feature: { type: 'string', enum: ['first_line_indent'] },
        disposition: { type: 'string', enum: ['not_applicable'] },
        value: { type: 'null' },
        reason: { type: 'string', enum: ['heading_has_no_prose_first_line'] },
      },
    });
  featureArray.items = { anyOf: branches };
  output.description =
    'AVA finite OCR source-feature comparison. Each observed value must match its feature type and existing source Style bounds. Preserve observed false and zero. Never clamp a measurement or choose a smaller value to fit a bound. A second column is not a large paragraph inset: a full-width introduction or the other column is not its margin baseline. If the local body-column boundary, source em size or representable measurement is not established, return unknown with value null and source_context_insufficient; do not guess. Essential paragraph role uncertainty still refuses. Exact requested coverage and source evidence remain enforced by the host and installed worker.';
  return output;
}
