import type { AnchorRepairTask } from './anchor-repair-types';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { allowedQuotations } from './anchor-quote-candidates';
import { wholeTokenRange } from './small-caps-quote-candidates';
import { PdfRuntimeError } from '../runtime/runtime-error';
type Owner = RecognitionResponse['segments'][number];
export function validateSmallCapsRange(
  task: AnchorRepairTask,
  patch: { segment_index: number; span_index: number },
  original: RecognitionResponse,
  segment: Owner,
  span: Owner['spans'][number],
) {
  if (!span.anchor) throw new PdfRuntimeError('INVALID_RESULT');
  if (task.schema_version === 'ava-recognition-anchor-quote-task-3') {
    const originalSpan =
      original.segments[patch.segment_index].spans[patch.span_index];
    if (!allowedQuotations(segment.text, originalSpan).length) {
      const at = segment.text.indexOf(span.anchor.exact_text);
      let selected = -1;
      for (
        let pos = at;
        pos >= 0;
        pos = segment.text.indexOf(span.anchor.exact_text, pos + 1)
      ) {
        const end = pos + span.anchor.exact_text.length;
        if (
          segment.text.slice(0, pos).endsWith(span.anchor.before ?? '') &&
          segment.text.slice(end).startsWith(span.anchor.after ?? '')
        )
          selected = pos;
      }
      if (
        selected < 0 ||
        !wholeTokenRange(
          segment.text,
          selected,
          selected + span.anchor.exact_text.length,
        )
      )
        throw new PdfRuntimeError('INVALID_RESULT');
    }
  }
}
