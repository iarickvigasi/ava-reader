import type { RecognitionResponse } from './generated/RecognitionResponse';
import { allowedQuotations } from './anchor-quote-candidates';

type Span = RecognitionResponse['segments'][number]['spans'][number];
const wordChar = (value: string) =>
  /[\p{L}\p{M}\p{N}\p{Pc}\p{Cf}]/u.test(value);
export function wholeTokenRange(text: string, start: number, end: number) {
  const before = Array.from(text.slice(0, start)).at(-1);
  const after = Array.from(text.slice(end))[0];
  return (!before || !wordChar(before)) && (!after || !wordChar(after));
}
export function smallCapsQuotations(text: string, span: Span): string[] {
  const original = allowedQuotations(text, span);
  if (original.length) return original;
  const quote = span.anchor?.exact_text;
  if (span.style?.small_caps !== true || !quote || !/^[a-z]{1,16}$/.test(quote))
    return [];
  const alternative = quote.toUpperCase();
  for (
    let at = text.indexOf(alternative);
    at >= 0;
    at = text.indexOf(alternative, at + 1)
  )
    if (wholeTokenRange(text, at, at + alternative.length))
      return [alternative];
  return [];
}
