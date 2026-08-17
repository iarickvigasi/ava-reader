import { BadRequestException } from '@nestjs/common';
import type {
  ReaderLocator,
  ReadingProgressIndex,
  ReadingProgressIndexChapter,
} from '../reader-types';
import { findBestTocLabel } from './toc-label';

// A chapter counts unless the analysis explicitly said otherwise. v1 indexes
// carry no flag at all, so they count everything — identical to pre-analysis
// behaviour.
function isCountedChapter(chapter: ReadingProgressIndexChapter): boolean {
  return chapter.counted !== false;
}

export function computeProgressMetricsFromIndex(
  index: ReadingProgressIndex,
  locator: ReaderLocator,
) {
  const chapterIndex = index.chapters.findIndex(
    (chapter) => chapter.chapterId === locator.chapterId,
  );

  if (chapterIndex === -1) {
    throw new BadRequestException('The requested chapter does not exist.');
  }

  const chapter = index.chapters[chapterIndex];
  const blockIndex = chapter.blockIds.indexOf(locator.blockId);

  if (blockIndex === -1) {
    throw new BadRequestException('The requested block does not exist.');
  }

  // An index where nothing counts would zero both sides of the ratio and pin
  // the reader at 0% forever. That means the labelling is degenerate, so ignore
  // it entirely rather than trust it — the aggregate guard should already have
  // caught this, and whole-book progress is the honest fallback.
  const anyChapterCounts = index.chapters.some(isCountedChapter);
  const counts = (candidate: ReadingProgressIndexChapter) =>
    !anyChapterCounts || isCountedChapter(candidate);

  // Only chapters that count contribute to either side of the ratio, so notes,
  // references and contents pages no longer dilute progress. On a v1 index
  // every chapter counts and this reduces to the original whole-book maths.
  const countedBlocksBefore = index.chapters
    .slice(0, chapterIndex)
    .reduce(
      (sum, currentChapter) =>
        counts(currentChapter) ? sum + currentChapter.blockIds.length : sum,
      0,
    );
  // A locator inside an uncounted chapter contributes nothing of its own, which
  // lands on exactly the right answer at both ends: front matter reads 0%, and
  // back matter — where every counted block already lies behind the reader —
  // reads 100%. Without this a novel trailing a long bibliography could never
  // reach 100%, so it never left the "currently reading" shelf.
  const absoluteBlockIndex =
    countedBlocksBefore + (counts(chapter) ? blockIndex + 1 : 0);
  const totalCountedBlocks = anyChapterCounts
    ? (index.bodyBlocks ?? index.totalBlocks)
    : index.totalBlocks;
  const completionPercent =
    totalCountedBlocks > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((absoluteBlockIndex / totalCountedBlocks) * 100),
          ),
        )
      : 0;

  return {
    chapterLabel:
      findBestTocLabel(index.toc, locator) ?? chapter.title ?? chapter.label,
    completionPercent,
  };
}
