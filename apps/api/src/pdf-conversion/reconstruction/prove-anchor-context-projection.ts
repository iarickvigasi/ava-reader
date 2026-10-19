import { PdfRuntimeError } from '../runtime/runtime-error';
import {
  anchorContextBinding,
  contextSha,
  contextSlotKey,
} from './anchor-context-binding';
import { anchorPositions } from './anchor-positions';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorContextResponse } from './generated/RecognitionAnchorContextResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { AnchorContextProjection } from './anchor-context-projection-evidence';

export function proveAnchorContextProjection(
  task: RecognitionAnchorContextTask,
  parent: RecognitionTask,
  original: RecognitionResponse,
  rawOutput: string,
  raw: RecognitionAnchorContextResponse,
  derived: RecognitionAnchorContextResponse,
  changed: Set<number>,
): AnchorContextProjection {
  // A projection is not an escape from exact source/task/original-span authority.
  anchorContextBinding(task, parent, original);
  if (
    derived.outcome !== 'corrected' ||
    derived.unresolved_reason != null ||
    derived.patches.length !== task.slots.length
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const slots: AnchorContextProjection['slots'] = [],
    seen = new Set<string>();
  for (let i = 0; i < derived.patches.length; i++) {
    const patch = derived.patches[i],
      full = raw.patches[i];
    const key = contextSlotKey(patch.segment_index, patch.span_index);
    const slot = task.slots.find(
      (s) => contextSlotKey(s.segment_index, s.span_index) === key,
    );
    const segment = original.segments[patch.segment_index],
      span = segment?.spans[patch.span_index];
    if (
      !slot ||
      seen.has(key) ||
      patch.span_sha256 !== slot.span_sha256 ||
      !span?.anchor
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    seen.add(key);
    if (!changed.has(i)) continue;
    const fullAt = anchorPositions(segment.text, {
      ...span.anchor,
      before: full.before,
      after: full.after,
    });
    const boundedAt = anchorPositions(segment.text, {
      ...span.anchor,
      before: patch.before,
      after: patch.after,
    });
    if (
      fullAt.length !== 1 ||
      boundedAt.length !== 1 ||
      fullAt[0] !== boundedAt[0]
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    slots.push({
      segmentIndex: patch.segment_index,
      spanIndex: patch.span_index,
      codePointStart: Array.from(segment.text.slice(0, fullAt[0])).length,
      originalBefore: Array.from(full.before).length,
      originalAfter: Array.from(full.after).length,
      finalBefore: Array.from(patch.before).length,
      finalAfter: Array.from(patch.after).length,
    });
  }
  return {
    method: 'ava-anchor-context-bounds-1',
    rawResponseSha256: contextSha(rawOutput),
    derivedResponseSha256: contextSha(JSON.stringify(derived)),
    originalResponseSha256: task.original_response_sha256,
    slots,
  };
}
