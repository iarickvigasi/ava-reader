import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import {
  contextSha,
  contextSlotKey,
  contextTaskId,
  sameContextJson,
} from './anchor-context-binding';
import { overflowContextSlots } from './overflow-context-slots';
import { overflowRecognitionCandidate } from './overflow-recognition-candidate';
import { exchangeJson } from '../runtime/exchange-json';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function overflowContextBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const task = validatePacket(
    'RecognitionOverflowContextTask',
    structuredClone(input),
  );
  const wire = JSON.parse(JSON.stringify(original)) as RecognitionResponse;
  const candidate = overflowRecognitionCandidate(parent, JSON.stringify(wire));
  if (
    !sameContextJson(candidate, wire) ||
    task.task_id === parent.task_id ||
    task.task_id !== contextTaskId(task) ||
    task.original_task_id !== parent.task_id ||
    task.source_sha256 !== parent.source_sha256 ||
    task.profile_id !== parent.profile_id ||
    task.page_number !== parent.page_number ||
    task.render_sha256 !== parent.image.sha256 ||
    task.native_evidence_sha256 !== parent.native_evidence_sha256 ||
    !sameContextJson(task.image, parent.image) ||
    Buffer.byteLength(task.original_response_json) > 8 * 1024 ** 2 ||
    contextSha(task.original_response_json) !== task.original_response_sha256 ||
    !sameContextJson(
      exchangeJson(Buffer.from(task.original_response_json)),
      wire,
    )
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const invalid = overflowContextSlots(wire),
    seen = new Set<string>();
  for (const slot of task.slots) {
    const key = contextSlotKey(slot.segment_index, slot.span_index),
      segment = wire.segments[slot.segment_index],
      span = segment?.spans[slot.span_index];
    if (
      !segment ||
      !span ||
      seen.has(key) ||
      invalid.get(key) !== slot.reason ||
      segment.id !== slot.segment_id ||
      contextSha(segment.text) !== slot.segment_text_sha256 ||
      contextSha(slot.original_span_json) !== slot.span_sha256 ||
      !sameContextJson(exchangeJson(Buffer.from(slot.original_span_json)), span)
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    seen.add(key);
  }
  if (seen.size !== invalid.size) throw new PdfRuntimeError('INVALID_RESULT');
  return task;
}
