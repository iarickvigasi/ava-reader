import { createHash } from 'node:crypto';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
const sha = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');

export function nativeStructureTaskBinding(
  input: NativeStructureTask,
  sourceSha256: string,
  page: number,
) {
  const task = validatePacket('NativeStructureTask', structuredClone(input));
  const image = Buffer.from(task.image.base64, 'base64');
  if (
    task.source_sha256 !== sourceSha256 ||
    task.page_number !== page ||
    image.toString('base64') !== task.image.base64 ||
    image.length !== task.image.byte_length ||
    sha(image) !== task.image.sha256 ||
    new Set(task.lines.map((line) => line.id)).size !== task.lines.length ||
    task.lines.some((line) => sha(line.text) !== line.text_sha256)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const spans = new Map(
    task.lines.flatMap((line) =>
      line.spans.map((span) => [span.id, { span, line }] as const),
    ),
  );
  const callouts = new Set<string>();
  for (const callout of task.eligible_callouts) {
    const source = spans.get(callout.span_id);
    if (
      callouts.has(callout.span_id) ||
      !source ||
      source.line.id !== callout.line_id ||
      source.span.style?.vertical_align !== 'super' ||
      Array.from(source.line.text)
        .slice(source.span.start, source.span.end)
        .join('') !== callout.exact_text
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    callouts.add(callout.span_id);
  }
  // Image decoding, stable task identity and source ownership are worker-checked
  // before this task is advertised; the same worker accepts its receipt before advancing.
  return task;
}
