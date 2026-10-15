import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionAnchorQuoteTask } from './generated/RecognitionAnchorQuoteTask';
import { createHash } from 'node:crypto';

type Span = RecognitionResponse['segments'][number]['spans'][number];
const digits = '0123456789';
const families = { super: '⁰¹²³⁴⁵⁶⁷⁸⁹', sub: '₀₁₂₃₄₅₆₇₈₉' };
export function allowedQuotations(text: string, span: Span): string[] {
  const quote = span.anchor?.exact_text;
  if (!quote) return [];
  const result = text.includes(quote) ? [quote] : [];
  const alignment = span.style?.vertical_align;
  const script =
    alignment === 'super' || alignment === 'sub'
      ? families[alignment]
      : undefined;
  if (script) {
    const chars = Array.from(quote);
    const from = chars.every((c) => digits.includes(c))
      ? digits
      : chars.every((c) => script.includes(c))
        ? script
        : undefined;
    if (from) {
      const to = from === digits ? script : digits;
      const alternative = chars.map((c) => to[from.indexOf(c)]).join('');
      if (text.includes(alternative) && !result.includes(alternative))
        result.push(alternative);
    }
  }
  return result;
}
export function quoteTaskId(task: RecognitionAnchorQuoteTask) {
  return (
    'anchor-quote-' +
    createHash('sha256')
      .update(
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
            s.allowed_quotations,
          ]),
        ]),
      )
      .digest('hex')
  );
}
