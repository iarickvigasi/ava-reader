import { useState } from "react";
import { useViewportSize } from "./use-viewport-size";
import { useMeasurementCache } from "./measurement/use-measurement-cache";
import { useRestoreController } from "./restore/use-restore-controller";
import { useLocatorSync } from "./locator/use-locator-sync";
import { usePageNavigation } from "./navigation/use-page-navigation";
import { useArticleStyle } from "./layout/use-article-style";
import { usePaginationLayoutKeys } from "./layout/use-pagination-layout-keys";
import { useSpreadBlocks } from "./layout/use-spread-blocks";
import type {
  UseReaderPaginationInput,
  UseReaderPaginationResult,
} from "./use-reader-pagination.types";

/**
 * useReaderPagination = thin orchestrator that wires together:
 * - viewport sizing
 * - measurement caching + layout keys
 * - two-column spread composition (prefix / spillover)
 * - restore-intent state machine
 * - locator publishing
 * - page navigation (keyboard + touch)
 * - article CSS styling
 */
export function useReaderPagination({
  activeChapter,
  fontScale,
  isBootstrapping,
  isLoadingChapter,
  isPanelOpen,
  libraryItemId,
  nextChapter,
  onSelectChapter,
  onVisibleLocatorChange,
  previousChapter,
  restoreIntent,
  visibleLocator,
}: UseReaderPaginationInput): UseReaderPaginationResult {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const { availableHeight, pageBoxRef, pageBoxSize, rootRef } =
    useViewportSize();

  const { activePaginationLayoutKey, previousPaginationLayoutKey } =
    usePaginationLayoutKeys({
      activeChapter,
      previousChapter,
      fontScale,
      libraryItemId,
      pageBoxSize,
    });

  const {
    activeMeasurementEntry,
    activeReadyMeasurementEntry,
    pageCount,
    previousChapterPageCount,
    storeMeasurementEntry,
    warnFailedMeasurement,
  } = useMeasurementCache({
    activePaginationLayoutKey,
    previousPaginationLayoutKey,
  });

  const activeRestoreCycleKey = restoreIntent?.key ?? activeChapter.chapterId;

  // Prefix/spillover feed the restore, locator and style hooks below, so this
  // must run before them.
  const { prefixBlocks, prefixPageCount, spilloverBlocks } = useSpreadBlocks({
    activeChapter,
    previousChapter,
    nextChapter,
    previousChapterPageCount,
    pageCount,
    pageBoxSize,
  });

  const restorePhase = useRestoreController({
    activePaginationLayoutKey,
    activeMeasurementEntry,
    activeChapter,
    prefixPageCount,
    restoreIntent,
    pageCount,
    currentPageIndex,
    setCurrentPageIndex,
    warnFailedMeasurement,
    activeRestoreCycleKey,
    visibleLocator,
  });

  useLocatorSync({
    currentPageIndex,
    activeReadyMeasurementEntry,
    isBootstrapping,
    prefixPageCount,
    restorePhase,
    visibleLocator,
    onVisibleLocatorChange,
  });

  const { handleTouchEnd, handleTouchStart } = usePageNavigation({
    currentPageIndex,
    setCurrentPageIndex,
    pageCount,
    isLoadingChapter,
    isPanelOpen,
    activeChapter,
    onSelectChapter,
    containerRef: pageBoxRef,
  });

  const { articleStyle, shouldMaskArticle } = useArticleStyle({
    pageBoxSize,
    currentPageIndex,
    isBootstrapping,
    isLoadingChapter,
    restorePhase,
    prefixPageCount,
  });

  return {
    articleStyle,
    availableHeight,
    currentPageIndex,
    handleTouchEnd,
    handleTouchStart,
    pageBoxRef,
    pageBoxSize,
    pageCount,
    prefixBlocks,
    rootRef,
    shouldMaskArticle,
    spilloverBlocks,
    storeMeasurementEntry,
  };
}
