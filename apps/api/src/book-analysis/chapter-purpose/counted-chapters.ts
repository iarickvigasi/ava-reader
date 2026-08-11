import type { ChapterPurposeAnalysis } from './finalize-analysis';

/**
 * The single answer to "does this chapter count?" once an analysis exists.
 *
 * Both consumers — the progress index and the body page count — have to agree.
 * A chapter counted for progress but excluded from the page count would make
 * completion percent and reading time tell different stories about the same
 * book, and the two are read side by side.
 *
 * An unrecognised chapter counts. That is the same asymmetry `policy.ts`
 * applies to low-confidence labels: over-counting degrades to the pre-analysis
 * estimate, while under-counting invents a number that is simply wrong.
 */
export function createCountedLookup(
  analysis: ChapterPurposeAnalysis,
): (chapterId: string) => boolean {
  const byChapterId = new Map(
    analysis.chapters.map((entry) => [entry.chapterId, entry.counted]),
  );

  return (chapterId: string) => byChapterId.get(chapterId) ?? true;
}
