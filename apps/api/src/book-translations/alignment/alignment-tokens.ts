import type { AlignmentSpan } from '../types';

export type AlignmentToken = AlignmentSpan & { id: number; text: string };

// Segment the exact persisted text. IDs, rather than model-counted character
// offsets, disambiguate repeated words and keep UTF-16 offsets deterministic.
export function alignmentTokens(
  text: string,
  language: string | null,
): AlignmentToken[] {
  let locale: string | undefined;
  try {
    locale = language ? new Intl.Locale(language).toString() : undefined;
  } catch {
    /* Legacy language name. */
  }
  return Array.from(
    new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
  )
    .filter((part) => part.segment.trim())
    .map((part, id) => ({
      id,
      text: part.segment,
      start: part.index,
      end: part.index + part.segment.length,
    }));
}
