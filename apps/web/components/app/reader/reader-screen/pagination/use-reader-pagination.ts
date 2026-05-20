import type {
  CSSProperties,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useMemo, useState } from "react";
import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderLocator,
} from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  RestoreIntent,
} from "@/features/reader/navigation";
import { createPaginationLayoutKey } from "@/features/reader/pagination";
import type {
  ReaderMeasurementEntry,
} from "@/features/reader/measurement";
import type { PageBoxSize } from "../shared/types";
import { resolveReaderColumnCount } from "../shared/utils";
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
  // Previous chapter — when single-page in two-column mode, its blocks are
  // surfaced as `prefixBlocks` so the active chapter starts in column 2.
  previousChapter?: ReaderChapterPayload | null;
  // Next chapter — when the active chapter is single-page in two-column mode,
  // its blocks are surfaced as `spilloverBlocks` so column 2 isn't wasted.
  nextChapter?: ReaderChapterPayload | null;
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
  // Previous chapter's blocks to render before the active chapter (spread
  // column 1) when the previous chapter is single-page in two-column mode.
  prefixBlocks: ReaderBlock[] | undefined;
  rootRef: RefObject<HTMLDivElement | null>;
  shouldMaskArticle: boolean;
  // Next chapter's blocks to render after the active chapter (spread
  // column 2) when the active chapter is single-page in two-column mode.
  spilloverBlocks: ReaderBlock[] | undefined;
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
  nextChapter,
  onSelectChapter,
  onVisibleLocatorChange,
  previousChapter,
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

  // Layout key for the previous chapter so we can read its measured page
  // count from the same cache.
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

  // Spreads only make sense in two-column layouts; single-column views
  // already use the full width per chapter.
  const isTwoColumnLayout = resolveReaderColumnCount(pageBoxSize.width) >= 2;

  // Prefix: previous chapter was single-page → render it as column 1 and
  // shift the active chapter's translate by one page so its column 1 isn't
  // re-shown (the user already saw it in the previous chapter's spread).
  // Hoisted above useRestoreController so the controller can translate
  // preloader-space page indices into the user's visible page when the
  // prefix shift is active.
  const isPreviousSinglePageSpread =
    isTwoColumnLayout &&
    previousChapterPageCount === 1 &&
    Boolean(previousChapter) &&
    activeChapter.previousChapterId === previousChapter?.chapterId;
  const prefixBlocks = isPreviousSinglePageSpread
    ? previousChapter?.blocks
    : undefined;
  const prefixPageCount = isPreviousSinglePageSpread ? 1 : 0;

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
  });

  // Spillover: active chapter is single-page → flow next chapter into
  // column 2 so the empty half-screen isn't wasted.
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
