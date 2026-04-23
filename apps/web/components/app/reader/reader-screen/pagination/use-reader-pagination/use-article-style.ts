import { useMemo } from "react";
import type { CSSProperties } from "react";
import { PAGE_GAP } from "../../shared/constants";
import type { PageBoxSize } from "../../shared/types";
import { READER_RESTORE_PHASE_SETTLED } from "../use-reader-pagination.helpers";
import type { ReaderRestorePhase } from "../use-reader-pagination.helpers";

export function useArticleStyle({
  pageBoxSize,
  currentPageIndex,
  isBootstrapping,
  isLoadingChapter,
  restorePhase,
}: {
  pageBoxSize: PageBoxSize;
  currentPageIndex: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  restorePhase: ReaderRestorePhase;
}) {
  const pageSpan = pageBoxSize.width > 0 ? pageBoxSize.width + PAGE_GAP : 0;
  const pageTranslate = currentPageIndex * pageSpan;

  const articleStyle = useMemo(
    () =>
      ({
        columnGap: `${PAGE_GAP}px`,
        columnWidth:
          pageBoxSize.width > 0 ? `${pageBoxSize.width}px` : "auto",
        height:
          pageBoxSize.height > 0 ? `${pageBoxSize.height}px` : undefined,
        transform: `translate3d(-${pageTranslate}px, 0, 0)`,
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
