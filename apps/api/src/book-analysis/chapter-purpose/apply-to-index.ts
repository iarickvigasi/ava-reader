import type { ReadingProgressIndex } from '../../reader/reader-types';
import type { ChapterPurposeAnalysis } from './chapter-purpose';
import { createCountedLookup } from './counted-chapters';

/**
 * Folds the analysis into the compact progress index, taking it to v2.
 *
 * The index is a derived cache — storing the counting outcome here is what lets
 * `computeProgressMetricsFromIndex` stay a single cheap read instead of joining
 * the analysis on every progress write. `BookAnalysis.result` remains the
 * source of truth, so a change to the counting policy is a backfill from stored
 * purposes rather than an AI re-run.
 */
export function applyPurposesToIndex(
  index: ReadingProgressIndex,
  analysis: ChapterPurposeAnalysis,
): ReadingProgressIndex {
  const counts = createCountedLookup(analysis);
  const chapters = index.chapters.map((chapter) => ({
    ...chapter,
    counted: counts(chapter.chapterId),
  }));

  return {
    ...index,
    bodyBlocks: chapters.reduce(
      (sum, chapter) => (chapter.counted ? sum + chapter.blockIds.length : sum),
      0,
    ),
    chapters,
    version: 2,
  };
}
