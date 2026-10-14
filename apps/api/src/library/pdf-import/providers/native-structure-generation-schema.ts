import { z } from 'zod';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';

const id = z.string().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const publicSource = z.object({
  schema_version: z.literal('ava-native-structure-task-2'),
  purpose: z.literal('pdf_native_structure'),
  task_id: id,
  source_sha256: sha256,
  observation_sha256: sha256,
  render_sha256: sha256,
  page_number: z.number().int().min(1).max(500),
  lines: z.array(z.object({ id })).min(1).max(10000),
  boundaries: z
    .array(z.object({ candidate_id: id, left_line_id: id, right_line_id: id }))
    .max(10000),
  eligible_callouts: z.array(z.object({ span_id: id, line_id: id })).max(20000),
});
type Schema = Record<string, unknown>;
const invalid = () => new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid();
  return value as Schema;
};

// The provider builder already validates Task2. Derive limits from its exact public
// projection, which the retained task/request hashes bind; never trust supplied counts.
export function nativeStructureGenerationSchema(
  schema: Schema,
  task: ProviderTask,
): Schema {
  const users = task.messages.filter((message) => message.role === 'user');
  if (users.length !== 1 || typeof users[0].content === 'string')
    throw invalid();
  const texts = users[0].content.filter((part) => part.type === 'text');
  if (texts.length !== 1) throw invalid();
  let decoded: unknown;
  try {
    decoded = JSON.parse(texts[0].text);
  } catch {
    throw invalid();
  }
  const parsed = publicSource.safeParse(decoded);
  if (!parsed.success) throw invalid();
  const source = parsed.data;
  const lines = new Set(source.lines.map((line) => line.id));
  const eligible = new Set(
    source.eligible_callouts.map((callout) => callout.span_id),
  );
  if (
    task.purpose !== 'resolve_structure' ||
    task.promptVersion !== 'ava-native-structure-2' ||
    task.schemaVersion !== 'ava-native-structure-response-2' ||
    source.task_id !== task.taskId ||
    source.source_sha256 !== task.sourceSha256 ||
    task.pageIndices.length !== 1 ||
    task.pageIndices[0] !== source.page_number - 1 ||
    lines.size !== source.lines.length ||
    new Set(source.boundaries.map((boundary) => boundary.candidate_id)).size !==
      source.boundaries.length ||
    source.boundaries.some(
      (boundary) =>
        !lines.has(boundary.left_line_id) || !lines.has(boundary.right_line_id),
    ) ||
    source.eligible_callouts.some((callout) => !lines.has(callout.line_id))
  )
    throw invalid();
  const output = structuredClone(schema);
  const properties = record(output.properties);
  const groups = record(properties.groups);
  if (typeof groups.maxItems !== 'number') throw invalid();
  groups.maxItems = Math.min(groups.maxItems, lines.size);
  const variants = record(groups.items).anyOf;
  if (!Array.isArray(variants) || variants.length !== 8) throw invalid();
  for (const variant of variants)
    record(record(record(variant).properties).line_ids).maxItems = lines.size;
  const boundaries = record(properties.boundary_dispositions);
  boundaries.maxItems = source.boundaries.length;
  record(properties.references).maxItems = eligible.size;
  return output;
}
