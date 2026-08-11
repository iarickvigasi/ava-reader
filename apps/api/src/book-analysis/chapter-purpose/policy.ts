import type { ChapterConfidence, ChapterPurpose } from './schema';

/**
 * The model reports *what a chapter is*; this file decides *whether it counts*.
 *
 * Keeping the two apart means changing "do introductions count?" is a one-line
 * edit here — no prompt change, and no re-running a single book.
 */
const COUNTED_PURPOSES: ReadonlySet<ChapterPurpose> = new Set<ChapterPurpose>([
  'BODY',
  'PREFACE',
  'AFTERWORD',
  'UNKNOWN',
]);

/**
 * Low confidence counts as readable text. The asymmetry is deliberate:
 * over-counting degrades to the old whole-book behaviour, while under-counting
 * invents a number that is simply wrong.
 */
export function countsTowardReading(input: {
  confidence: ChapterConfidence;
  purpose: ChapterPurpose;
}): boolean {
  if (input.confidence === 'low') {
    return true;
  }

  return COUNTED_PURPOSES.has(input.purpose);
}

/**
 * Books are overwhelmingly body text. If the labelling says otherwise, it is
 * likelier that the analysis went wrong than that the book is 70% apparatus —
 * so fall back to counting everything rather than showing a wild estimate.
 */
const MIN_BODY_WORD_RATIO = 0.4;

export function tripsAggregateGuard(
  chapters: { counted: boolean; wordCount: number }[],
): boolean {
  const totalWords = chapters.reduce(
    (sum, chapter) => sum + chapter.wordCount,
    0,
  );

  if (totalWords === 0) {
    return true;
  }

  const countedWords = chapters
    .filter((chapter) => chapter.counted)
    .reduce((sum, chapter) => sum + chapter.wordCount, 0);

  return countedWords / totalWords < MIN_BODY_WORD_RATIO;
}
