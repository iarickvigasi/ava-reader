import type { AnchorRepairTask } from './anchor-repair-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { parsePacket } from './validate-packet';
import { recognitionResponse } from './recognition-response';
import { anchorMatches, contextSlotKey } from './anchor-context-binding';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function anchorContextResponse(
  task: AnchorRepairTask,
  output: string,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const response = parsePacket(
    task.schema_version === 'ava-recognition-anchor-quote-task-2'
      ? 'RecognitionAnchorQuoteResponse'
      : 'RecognitionAnchorContextResponse',
    Buffer.from(output),
    2 * 1024 ** 2,
  );
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.render_sha256 !== task.render_sha256 ||
    response.original_task_id !== task.original_task_id ||
    response.original_response_sha256 !== task.original_response_sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (response.outcome === 'unresolved') {
    if (response.patches.length || !response.unresolved_reason)
      throw new PdfRuntimeError('INVALID_RESULT');
    return { response, corrected: null };
  }
  if (
    response.unresolved_reason != null ||
    response.patches.length !== task.slots.length
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const corrected = structuredClone(original),
    seen = new Set<string>();
  for (const patch of response.patches) {
    const key = contextSlotKey(patch.segment_index, patch.span_index);
    const slot = task.slots.find(
      (s) => contextSlotKey(s.segment_index, s.span_index) === key,
    );
    const segment = corrected.segments[patch.segment_index];
    const span = segment?.spans[patch.span_index];
    if (
      !slot ||
      seen.has(key) ||
      patch.span_sha256 !== slot.span_sha256 ||
      !span?.anchor
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    if ('exact_text' in patch) {
      const quoteSlot =
        task.schema_version === 'ava-recognition-anchor-quote-task-2'
          ? task.slots.find(
              (s) => contextSlotKey(s.segment_index, s.span_index) === key,
            )
          : undefined;
      if (!quoteSlot?.allowed_quotations.includes(patch.exact_text))
        throw new PdfRuntimeError('INVALID_RESULT');
      span.anchor.exact_text = patch.exact_text;
    }
    span.anchor.before = patch.before;
    span.anchor.after = patch.after;
    if (anchorMatches(segment.text, span.anchor) !== 1)
      throw new PdfRuntimeError('INVALID_RESULT');
    seen.add(key);
  }
  // The worker still performs its full Python semantic/source acceptance before advancing.
  return {
    response,
    corrected: recognitionResponse(parent, JSON.stringify(corrected)),
  };
}
