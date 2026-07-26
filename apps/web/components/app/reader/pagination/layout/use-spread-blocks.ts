import { useMemo } from "react";
import type { ReaderBlock, ReaderChapterPayload } from "@/lib/api-types";
import type { PageBoxSize } from "../../shared/types";
import { resolveReaderColumnCount } from "../../shared/utils";

// Two-column spread composition. Spreads only apply in two-column layouts;
// single-column views already use the full width per chapter.
// - prefix: the previous chapter was single-page → render it as column 1 and
//   shift the active chapter by one page (prefixPageCount) so its column 1
//   isn't re-shown. Consumed by the restore/locator/style hooks, so it must be
//   computed before them.
// - spillover: the active chapter is single-page → flow the next chapter into
//   column 2 so the empty half-screen isn't wasted.
export function useSpreadBlocks({
  activeChapter,
  previousChapter,
  nextChapter,
  previousChapterPageCount,
  pageCount,
  pageBoxSize,
}: {
  activeChapter: ReaderChapterPayload;
  previousChapter?: ReaderChapterPayload | null;
  nextChapter?: ReaderChapterPayload | null;
  previousChapterPageCount: number | null;
  pageCount: number;
  pageBoxSize: PageBoxSize;
}): {
  prefixBlocks: ReaderBlock[] | undefined;
  prefixPageCount: number;
  spilloverBlocks: ReaderBlock[] | undefined;
} {
  const isTwoColumnLayout = resolveReaderColumnCount(pageBoxSize.width) >= 2;

  const isPreviousSinglePageSpread =
    isTwoColumnLayout &&
    previousChapterPageCount === 1 &&
    Boolean(previousChapter) &&
    activeChapter.previousChapterId === previousChapter?.chapterId;
  const prefixBlocks = isPreviousSinglePageSpread
    ? previousChapter?.blocks
    : undefined;
  const prefixPageCount = isPreviousSinglePageSpread ? 1 : 0;

  const spilloverBlocks = useMemo(() => {
    if (
      !isTwoColumnLayout ||
      pageCount !== 1 ||
      !nextChapter ||
      activeChapter.nextChapterId !== nextChapter.chapterId
    ) {
      return undefined;
    }

    return nextChapter.blocks;
  }, [
    activeChapter.nextChapterId,
    isTwoColumnLayout,
    nextChapter,
    pageCount,
  ]);

  return { prefixBlocks, prefixPageCount, spilloverBlocks };
}
