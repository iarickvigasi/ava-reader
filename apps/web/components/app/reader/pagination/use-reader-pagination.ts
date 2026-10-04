import { useState } from "react";
import { usePaginationMeasurements } from "./use-pagination-measurements";
import { READER_RESTORE_PHASE_SETTLED } from "./restore/restore-phase";
import { useRestoreController } from "./restore/use-restore-controller";
import { useLocatorSync } from "./locator/use-locator-sync";
import { usePageNavigation } from "./navigation/use-page-navigation";
import { useArticleStyle } from "./layout/use-article-style";
import type {
  UseReaderPaginationInput,
  UseReaderPaginationResult,
} from "./use-reader-pagination.types";

export function useReaderPagination(
  input: UseReaderPaginationInput,
): UseReaderPaginationResult {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const environment = usePaginationMeasurements(input);
  const activeRestoreCycleKey = `${input.restoreIntent?.key ?? input.activeChapter.chapterId}:${environment.activePaginationLayoutKey}`;
  const restorePhase = useRestoreController({
    ...input,
    ...environment,
    currentPageIndex,
    setCurrentPageIndex,
    activeRestoreCycleKey,
  });
  useLocatorSync({
    ...input,
    ...environment,
    currentPageIndex,
    restorePhase,
  });
  const { handleTouchEnd, handleTouchStart } = usePageNavigation({
    ...input,
    ...environment,
    currentPageIndex,
    setCurrentPageIndex,
    isLoadingChapter:
      input.isLoadingChapter ||
      input.isBootstrapping ||
      restorePhase !== READER_RESTORE_PHASE_SETTLED,
    containerRef: environment.pageBoxRef,
  });
  const { articleStyle, shouldMaskArticle } = useArticleStyle({
    ...input,
    ...environment,
    currentPageIndex,
    restorePhase,
  });
  return {
    articleStyle,
    availableHeight: environment.availableHeight,
    currentPageIndex,
    handleTouchEnd,
    handleTouchStart,
    pageBoxRef: environment.pageBoxRef,
    pageBoxSize: environment.pageBoxSize,
    pageCount: environment.pageCount,
    prefixBlocks: environment.prefixBlocks,
    rootRef: environment.rootRef,
    shouldMaskArticle,
    spilloverBlocks: environment.spilloverBlocks,
    storeMeasurementEntry: environment.storeMeasurementEntry,
  };
}
