import type { ReaderChapter, ReaderPackage } from '../reader-types';

// How many chapters either side of the active one travel in the payload. A
// full package is tens of MB parsed, so the reader is fed a sliding window and
// pages through it (see specs/1-reader/1.3-navigation).
const CHAPTER_WINDOW_RADIUS = 1;

export function selectChapter(
  readerPackage: ReaderPackage,
  chapterId?: string | null,
): ReaderChapter | null {
  if (!chapterId) {
    return null;
  }

  return (
    readerPackage.chapters.find((chapter) => chapter.chapterId === chapterId) ??
    null
  );
}

export function selectChapterWindow(
  readerPackage: ReaderPackage,
  activeChapterId: string,
): ReaderChapter[] {
  const activeIndex = readerPackage.chapters.findIndex(
    (chapter) => chapter.chapterId === activeChapterId,
  );

  if (activeIndex === -1) {
    return [];
  }

  // Truncated, not padded, at either end of the book.
  const windowStart = Math.max(0, activeIndex - CHAPTER_WINDOW_RADIUS);
  const windowEnd = Math.min(
    readerPackage.chapters.length,
    activeIndex + CHAPTER_WINDOW_RADIUS + 1,
  );

  return readerPackage.chapters.slice(windowStart, windowEnd);
}
