import type { RecognitionResponse } from './generated/RecognitionResponse';
import { anchorMatches, contextSlotKey } from './anchor-context-binding';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function overflowContextSlots(response: RecognitionResponse) {
  const slots = new Map<
    string,
    'AMBIGUOUS_CONTEXT' | 'ABSENT_CONTEXT' | 'CONTEXT_LIMIT'
  >();
  let overflow = false;
  response.segments.forEach((segment, i) => {
    for (const row of segment.cells ?? [])
      for (const cell of row)
        for (const span of cell.spans)
          if (span.anchor && anchorMatches(cell.text, span.anchor) !== 1)
            throw new PdfRuntimeError('INVALID_RESULT');
    segment.spans.forEach((span, j) => {
      if (!span.anchor) throw new PdfRuntimeError('INVALID_RESULT');
      const long =
        Math.max(
          Array.from(span.anchor.before ?? '').length,
          Array.from(span.anchor.after ?? '').length,
        ) > 128;
      const matches = anchorMatches(segment.text, span.anchor);
      if (!long && matches === 1) return;
      if (
        !span.style ||
        span.start != null ||
        span.end != null ||
        span.url != null ||
        span.note_label != null ||
        span.target_text != null ||
        !segment.text.includes(span.anchor.exact_text)
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      overflow ||= long;
      slots.set(
        contextSlotKey(i, j),
        long
          ? 'CONTEXT_LIMIT'
          : matches > 1
            ? 'AMBIGUOUS_CONTEXT'
            : 'ABSENT_CONTEXT',
      );
    });
  });
  if (!overflow || !slots.size || slots.size > 512)
    throw new PdfRuntimeError('INVALID_RESULT');
  return slots;
}
