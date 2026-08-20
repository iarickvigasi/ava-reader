export type SentenceSegment = { start: number; end: number; text: string };

// Splits `text` into sentence segments with their character ranges, via
// Intl.Segmenter (UAX #29: `\n` is a mandatory break, so list items joined
// with newlines segment per item). Returns null when the runtime lacks
// Intl.Segmenter — callers treat that as "no sentences available".
export function segmentSentences(text: string): SentenceSegment[] | null {
  const SegmenterCtor = globalThis.Intl?.Segmenter;
  if (typeof SegmenterCtor !== "function") return null;
  const segmenter = new SegmenterCtor(undefined, { granularity: "sentence" });
  const segments: SentenceSegment[] = [];
  for (const part of segmenter.segment(text)) {
    segments.push({
      start: part.index,
      end: part.index + part.segment.length,
      text: part.segment,
    });
  }
  return segments;
}
