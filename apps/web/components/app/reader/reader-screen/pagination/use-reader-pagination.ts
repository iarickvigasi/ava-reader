import type {
  CSSProperties,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useMemo, useState } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
} from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  RestoreIntent,
} from "@/lib/reader-navigation";
import { createPaginationLayoutKey } from "@/lib/reader-pagination";
import type {
  ReaderMeasurementEntry,
} from "@/lib/reader-measurement";
import type { PageBoxSize } from "../shared/types";
import { useViewportSize } from "./use-reader-pagination/use-viewport-size";
import { useMeasurementCache } from "./use-reader-pagination/use-measurement-cache";
import { useRestoreController } from "./use-reader-pagination/use-restore-controller";
import { useLocatorSync } from "./use-reader-pagination/use-locator-sync";
import { usePageNavigation } from "./use-reader-pagination/use-page-navigation";
import { useArticleStyle } from "./use-reader-pagination/use-article-style";

export type UseReaderPaginationInput = {
  activeChapter: ReaderChapterPayload;
  fontScale: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isPanelOpen: boolean;
  libraryItemId: string;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
};

export type UseReaderPaginationResult = {
  articleStyle: CSSProperties;
  availableHeight: number;
  currentPageIndex: number;
  handleTouchEnd: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  pageBoxRef: RefObject<HTMLDivElement | null>;
  pageBoxSize: PageBoxSize;
  pageCount: number;
  rootRef: RefObject<HTMLDivElement | null>;
  shouldMaskArticle: boolean;
  storeMeasurementEntry: (entry: ReaderMeasurementEntry) => void;
};

/**
 * useReaderPagination = thin orchestrator that wires together:
 * - viewport sizing
 * - measurement caching
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
  onSelectChapter,
  onVisibleLocatorChange,
  restoreIntent,
  visibleLocator,
}: UseReaderPaginationInput): UseReaderPaginationResult {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const {
    availableHeight,
    pageBoxRef,
    pageBoxSize,
    rootRef,
  } = useViewportSize();

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

  const {
    activeMeasurementEntry,
    activeReadyMeasurementEntry,
    pageCount,
    storeMeasurementEntry,
    warnFailedMeasurement,
  } = useMeasurementCache({ activePaginationLayoutKey });

  const activeRestoreCycleKey = restoreIntent?.key ?? activeChapter.chapterId;

  const restorePhase = useRestoreController({
    activePaginationLayoutKey,
    activeMeasurementEntry,
    activeChapter,
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
  });

  const { articleStyle, shouldMaskArticle } = useArticleStyle({
    pageBoxSize,
    currentPageIndex,
    isBootstrapping,
    isLoadingChapter,
    restorePhase,
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
    rootRef,
    shouldMaskArticle,
    storeMeasurementEntry,
  };
}
