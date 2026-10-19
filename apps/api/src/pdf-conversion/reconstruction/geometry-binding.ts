import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { RecognitionGeometryTask } from './generated/RecognitionGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { validatePacket } from './validate-packet';
import { recognitionResponse } from './recognition-response';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';

export const geometrySha = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export function geometryTaskId(task: RecognitionGeometryTask) {
  return (
    'recognition-geometry-' +
    geometrySha(
      JSON.stringify([
        task.schema_version,
        task.purpose,
        task.prompt_version,
        task.response_schema_version,
        task.source_sha256,
        task.profile_id,
        task.page_number,
        task.original_task_id,
        task.render_sha256,
        task.native_evidence_sha256,
        task.original_response_sha256,
        task.image.byte_length,
        task.image.width,
        task.image.height,
        task.slots.map((slot) => [
          slot.segment_index,
          slot.segment_id,
          slot.segment_text_sha256,
          slot.original_box_sha256,
          slot.reason,
          slot.kind,
          slot.context,
        ]),
      ]),
    )
  );
}

export function geometryBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
  originalResponseJson: string,
) {
  const task = validatePacket('RecognitionGeometryTask', input);
  if (Buffer.byteLength(originalResponseJson) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  // Parse with duplicate-key refusal before the historical recognition parser normalizes colors.
  exchangeJson(Buffer.from(originalResponseJson));
  const bound = recognitionResponse(parent, originalResponseJson);
  const indexes = original.segments.flatMap((segment, index) =>
    segment.box.x0 >= segment.box.x1 || segment.box.y0 >= segment.box.y1
      ? [index]
      : [],
  );
  if (
    task.task_id !== geometryTaskId(task) ||
    task.source_sha256 !== parent.source_sha256 ||
    task.profile_id !== parent.profile_id ||
    task.page_number !== parent.page_number ||
    task.original_task_id !== parent.task_id ||
    task.render_sha256 !== parent.image.sha256 ||
    task.native_evidence_sha256 !== parent.native_evidence_sha256 ||
    !isDeepStrictEqual(task.image, parent.image) ||
    task.original_response_json !== originalResponseJson ||
    task.original_response_sha256 !== geometrySha(originalResponseJson) ||
    !isDeepStrictEqual(bound, original) ||
    !indexes.length ||
    !isDeepStrictEqual(
      task.slots.map((slot) => slot.segment_index),
      indexes,
    )
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  for (const slot of task.slots) {
    const segment = original.segments[slot.segment_index];
    if (
      !segment ||
      slot.segment_id !== segment.id ||
      slot.kind !== segment.kind ||
      slot.reason !== 'EMPTY_OR_REVERSED_BOX' ||
      slot.segment_text_sha256 !== geometrySha(segment.text) ||
      slot.context !== Array.from(segment.text).slice(0, 256).join('') ||
      slot.original_box_sha256 !== geometrySha(slot.original_box_json) ||
      !isDeepStrictEqual(
        exchangeJson(Buffer.from(slot.original_box_json)),
        segment.box,
      )
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  return task;
}
