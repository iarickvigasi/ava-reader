import { useMemo } from "react";
import type { CSSProperties } from "react";
import { PAGE_GAP } from "../../shared/constants";
import type { PageBoxSize } from "../../shared/types";
import { createReaderColumnLayoutStyle } from "../../shared/utils";
import {
  READER_RESTORE_PHASE_SETTLED,
  type ReaderRestorePhase,
} from "../restore/restore-phase";

export function useArticleStyle({
  pageBoxSize,
  currentPageIndex,
  isBootstrapping,
  isLoadingChapter,
  restorePhase,
  prefixPageCount = 0,
}: {
  pageBoxSize: PageBoxSize;
  currentPageIndex: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  restorePhase: ReaderRestorePhase;
  // Pages of prefix content rendered before the active chapter (e.g. a
  // single-page previous chapter). Skipped via translate3d so the active
  // chapter's first reading page lands at currentPageIndex=0.
  prefixPageCount?: number;
}) {
  // pageSpan is the horizontal distance between consecutive "pages".
  const pageSpan = pageBoxSize.width > 0 ? pageBoxSize.width + PAGE_GAP : 0;
  const pageTranslate = (currentPageIndex + prefixPageCount) * pageSpan;

  const articleStyle = useMemo(
    () =>
      ({
        ...createReaderColumnLayoutStyle({
          height: pageBoxSize.height,
          width: pageBoxSize.width,
        }),
        // Offset the current page with relative positioning, not a transform.
        // A translate3d promotes the article to a GPU-composited layer whose
        // raster tiles mobile WebKit fails to repaint when only the text
        // selection changes, so a selection highlight drawn mid-drag can be
        // stranded on a stale tile and stay invisible (see 1.2-pagination
        // "Page positioning" / 1.6-selection-bridge). `left` is a paint-only
        // offset on the normal paint path: geometry is identical (same width
        // and column count) and the selection always repaints. A page-turn
        // animation will re-introduce a transform transiently, only while the
        // slide is running.
        position: "relative",
        left: `-${pageTranslate}px`,
      }) as CSSProperties,
    [pageBoxSize.height, pageBoxSize.width, pageTranslate],
  );

  const shouldMaskArticle =
    isBootstrapping ||
    isLoadingChapter ||
    restorePhase !== READER_RESTORE_PHASE_SETTLED;

  return {
    articleStyle,
    shouldMaskArticle,
  };
}
