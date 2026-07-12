import { useMemo } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { createPaginationLayoutKey } from "@/features/reader/pagination-decision";
import type { PageBoxSize } from "../../shared/types";

// Derives the measurement-cache keys for the active chapter and (when present)
// the previous chapter, from the current viewport + font scale. The previous
// key lets the spread logic read the previous chapter's page count from the
// same cache. Returns null keys until the page box has a real size.
export function usePaginationLayoutKeys({
  activeChapter,
  previousChapter,
  fontScale,
  libraryItemId,
  pageBoxSize,
}: {
  activeChapter: ReaderChapterPayload;
  previousChapter?: ReaderChapterPayload | null;
  fontScale: number;
  libraryItemId: string;
  pageBoxSize: PageBoxSize;
}): {
  activePaginationLayoutKey: string | null;
  previousPaginationLayoutKey: string | null;
} {
  const activePaginationLayoutKey = useMemo(() => {
    if (pageBoxSize.width <= 0 || pageBoxSize.height <= 0) {
      return null;
    }

    return createPaginationLayoutKey({
      chapterId: activeChapter.chapterId,
      fontScale,
      libraryItemId,
      viewportHeight: pageBoxSize.height,
      viewportWidth: pageBoxSize.width,
    });
  }, [
    activeChapter.chapterId,
    fontScale,
    libraryItemId,
    pageBoxSize.height,
    pageBoxSize.width,
  ]);

  const previousPaginationLayoutKey = useMemo(() => {
    if (!previousChapter || pageBoxSize.width <= 0 || pageBoxSize.height <= 0) {
      return null;
    }

    return createPaginationLayoutKey({
      chapterId: previousChapter.chapterId,
      fontScale,
      libraryItemId,
      viewportHeight: pageBoxSize.height,
      viewportWidth: pageBoxSize.width,
    });
  }, [
    fontScale,
    libraryItemId,
    pageBoxSize.height,
    pageBoxSize.width,
    previousChapter,
  ]);

  return { activePaginationLayoutKey, previousPaginationLayoutKey };
}
