import {
  countChapterCharacters,
  pagesFromCharacters,
} from '../../reader/page-estimate';
import type { ReaderPackage } from '../../reader/reader-types';
import type { ChapterPurposeAnalysis } from './chapter-purpose';
import { createCountedLookup } from './counted-chapters';

/**
 * Pages worth of countable prose. Drives reading-time only —
 * `Book.estimatedPageCount` stays the whole book, which is the honest answer
 * for a "Pages" field. Two numbers that are each true beats one that is wrong.
 */
export function estimateBodyPageCount(
  readerPackage: ReaderPackage,
  analysis: ChapterPurposeAnalysis,
): null | number {
  const counts = createCountedLookup(analysis);
  const countedChapters = readerPackage.chapters.filter((chapter) =>
    counts(chapter.chapterId),
  );

  return pagesFromCharacters(countChapterCharacters(countedChapters));
}
