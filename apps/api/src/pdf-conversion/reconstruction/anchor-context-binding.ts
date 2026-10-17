import type { AnchorRepairTask } from './anchor-repair-types';
import { allowedQuotations, quoteTaskId } from './anchor-quote-candidates';
import { createHash } from 'node:crypto';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionOverflowContextTask } from './generated/RecognitionOverflowContextTask';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { validatePacket } from './validate-packet';

export const contextSha = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const contextSlotKey = (segment: number, span: number) =>
  `${segment}:${span}`;
export function contextTaskId(
  task: RecognitionAnchorContextTask | RecognitionOverflowContextTask,
) {
  return (
    'anchor-context-' +
    contextSha(
      JSON.stringify([
        task.schema_version,
        task.source_sha256,
        task.profile_id,
        task.page_number,
        task.original_task_id,
        task.render_sha256,
        task.native_evidence_sha256,
        task.original_response_sha256,
        task.slots.map((s) => [
          s.segment_index,
          s.segment_id,
          s.segment_text_sha256,
          s.span_index,
          s.span_sha256,
          s.reason,
        ]),
      ]),
    )
  );
}
type Span = RecognitionResponse['segments'][number]['spans'][number];
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
  );
}
export const sameContextJson = sameJson;
export function anchorMatches(
  text: string,
  anchor: NonNullable<Span['anchor']>,
) {
  let count = 0;
  for (
    let at = text.indexOf(anchor.exact_text);
    at >= 0;
    at = text.indexOf(anchor.exact_text, at + 1)
  ) {
    const end = at + anchor.exact_text.length;
    if (
      text.slice(0, at).endsWith(anchor.before ?? '') &&
      text.slice(end).startsWith(anchor.after ?? '')
    )
      if (++count > 1) break;
  }
  return count;
}

function invalidSlots(response: RecognitionResponse, quoteMode = false) {
  const slots = new Map<string, 'AMBIGUOUS_CONTEXT' | 'ABSENT_CONTEXT'>();
  response.segments.forEach((segment, segmentIndex) => {
    for (const row of segment.cells ?? [])
      for (const cell of row)
        if (
          cell.spans.some(
            (span) =>
              span.anchor && anchorMatches(cell.text, span.anchor) !== 1,
          )
        )
          throw new PdfRuntimeError('INVALID_RESULT');
    segment.spans.forEach((span, spanIndex) => {
      if (!span.anchor || anchorMatches(segment.text, span.anchor) === 1)
        return;
      if (
        span.start != null ||
        span.end != null ||
        (quoteMode
          ? !allowedQuotations(segment.text, span).length
          : !segment.text.includes(span.anchor.exact_text))
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      if (
        span.note_label != null ||
        span.target_text != null ||
        span.url != null
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      slots.set(
        contextSlotKey(segmentIndex, spanIndex),
        anchorMatches(segment.text, span.anchor) > 1
          ? 'AMBIGUOUS_CONTEXT'
          : 'ABSENT_CONTEXT',
      );
    });
  });
  return slots;
}

// Compare the exact wire object; Python and JavaScript need not serialize numbers/keys alike.
export function anchorContextBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const task = validatePacket(
    'RecognitionAnchorContextTask',
    structuredClone(input),
  );
  return bindAnchorRepair(task, parent, original);
}

export function anchorQuoteBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
) {
  const task = validatePacket(
    'RecognitionAnchorQuoteTask',
    structuredClone(input),
  );
  return bindAnchorRepair(task, parent, original);
}

function bindAnchorRepair<T extends AnchorRepairTask>(
  task: T,
  parent: RecognitionTask,
  original: RecognitionResponse,
): T {
  const quoteMode =
    task.schema_version === 'ava-recognition-anchor-quote-task-2';
  const wire = JSON.parse(JSON.stringify(original)) as RecognitionResponse;
  if (
    task.task_id === parent.task_id ||
    task.task_id !== (quoteMode ? quoteTaskId(task) : contextTaskId(task)) ||
    task.original_task_id !== parent.task_id ||
    task.source_sha256 !== parent.source_sha256 ||
    task.profile_id !== parent.profile_id ||
    task.page_number !== parent.page_number ||
    task.render_sha256 !== parent.image.sha256 ||
    task.native_evidence_sha256 !== parent.native_evidence_sha256 ||
    !sameJson(task.image, parent.image) ||
    Buffer.byteLength(task.original_response_json) > 8 * 1024 ** 2 ||
    contextSha(task.original_response_json) !== task.original_response_sha256 ||
    !sameJson(exchangeJson(Buffer.from(task.original_response_json)), wire)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const invalid = invalidSlots(wire, quoteMode),
    seen = new Set<string>();
  for (const slot of task.slots) {
    const key = contextSlotKey(slot.segment_index, slot.span_index);
    const segment = wire.segments[slot.segment_index];
    const span = segment?.spans[slot.span_index];
    if (
      ('allowed_quotations' in slot &&
        (!span ||
          !segment ||
          !sameJson(
            slot.allowed_quotations,
            allowedQuotations(segment.text, span),
          ))) ||
      seen.has(key) ||
      !segment ||
      !span ||
      invalid.get(key) !== slot.reason ||
      segment.id !== slot.segment_id ||
      contextSha(segment.text) !== slot.segment_text_sha256 ||
      contextSha(slot.original_span_json) !== slot.span_sha256 ||
      !sameJson(exchangeJson(Buffer.from(slot.original_span_json)), span)
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    seen.add(key);
  }
  if (!invalid.size || seen.size !== invalid.size)
    throw new PdfRuntimeError('INVALID_RESULT');
  return task;
}
