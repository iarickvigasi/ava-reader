import type {
  CSSProperties,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
} from "@/lib/api-types";
import {
  isStickyRestoreIntent,
  type ReaderNavigationTarget,
  type RestoreIntent,
} from "@/lib/reader-navigation";
import {
  createPaginationLayoutKey,
  resolvePaginationDecision,
} from "@/lib/reader-pagination";
import type {
  ReaderMeasurementEntry,
  ReaderMeasurementPageResolution,
} from "@/lib/reader-measurement";
import {
  PAGE_GAP,
  READER_NAVIGATION_EDGE_END,
  READER_NAVIGATION_EDGE_START,
  SWIPE_MAX_OFF_AXIS,
  SWIPE_THRESHOLD,
} from "../shared/constants";
import type { PageBoxSize } from "../shared/types";
import {
  clamp,
  createLocatorFromRestoreIntent,
  getBrowserViewportHeight,
  isInteractiveTarget,
} from "../shared/utils";

const READER_MEASUREMENT_STATUS_PENDING = "pending";
const READER_MEASUREMENT_STATUS_READY = "ready";
const READER_RESTORE_PHASE_RESTORING = "restoring";
const READER_RESTORE_PHASE_SETTLED = "settled";
const KEY_ARROW_LEFT = "ArrowLeft";
const KEY_ARROW_RIGHT = "ArrowRight";
const PAGE_DIRECTION_FORWARD = 1;
const PAGE_DIRECTION_BACKWARD = -1;

type UseReaderPaginationInput = {
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

type UseReaderPaginationResult = {
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

function resolvePageResolutionForLocator(input: {
  activeChapterId: string;
  locator: ReaderLocator | null;
  measurementEntry: Extract<ReaderMeasurementEntry, { status: "ready" }> | null;
}) {
  if (!input.measurementEntry || !input.locator) {
    return null;
  }

  if (input.locator.chapterId !== input.activeChapterId) {
    return null;
  }

  return input.measurementEntry.resolvePageIndex(
    input.locator,
  ) satisfies ReaderMeasurementPageResolution;
}

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
  const [measurementEntries, setMeasurementEntries] = useState(
    () => new Map<string, ReaderMeasurementEntry>(),
  );
  const [settledRestoreCycleKey, setSettledRestoreCycleKey] = useState<
    string | null
  >(null);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [pageBoxSize, setPageBoxSize] = useState<PageBoxSize>({
    height: 0,
    width: 0,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const consumedRestoreIntentKeyRef = useRef<string | null>(null);
  const currentPageIndexRef = useRef(0);
  const visibleLocatorRef = useRef<ReaderLocator | null>(visibleLocator);
  const restoreIntentRef = useRef<RestoreIntent | null>(restoreIntent);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const keepCommittedRestorePinnedRef = useRef(false);
  const settleRestoreFrameRef = useRef<number | null>(null);
  const warnedFailedMeasurementKeysRef = useRef(new Set<string>());
  const activeRestoreCycleKey = restoreIntent?.key ?? activeChapter.chapterId;

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  useEffect(() => {
    visibleLocatorRef.current = visibleLocator;
  }, [visibleLocator]);

  useEffect(() => {
    restoreIntentRef.current = restoreIntent;
  }, [restoreIntent]);

  useEffect(() => {
    return () => {
      if (settleRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(settleRestoreFrameRef.current);
      }
    };
  }, []);

  const syncAvailableHeight = useCallback(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const viewportHeight = getBrowserViewportHeight();
    const rootTop = root.getBoundingClientRect().top;
    const nextHeight = Math.max(320, Math.floor(viewportHeight - rootTop));

    setAvailableHeight((current) =>
      current === nextHeight ? current : nextHeight,
    );
  }, []);

  useEffect(() => {
    syncAvailableHeight();

    const visualViewport = window.visualViewport;
    const handleResize = () => {
      syncAvailableHeight();
    };

    window.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, [syncAvailableHeight]);

  const syncPageBoxSize = useCallback(() => {
    const pageBox = pageBoxRef.current;

    if (!pageBox) {
      return;
    }

    const nextSize = {
      height: Math.floor(pageBox.clientHeight),
      width: Math.floor(pageBox.clientWidth),
    };

    setPageBoxSize((current) =>
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize,
    );
  }, []);

  useEffect(() => {
    syncPageBoxSize();

    const pageBox = pageBoxRef.current;
    if (!pageBox) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncPageBoxSize();
    });
    resizeObserver.observe(pageBox);

    return () => {
      resizeObserver.disconnect();
    };
  }, [syncPageBoxSize]);

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

  const activeMeasurementEntry = activePaginationLayoutKey
    ? measurementEntries.get(activePaginationLayoutKey) ?? null
    : null;

  const activeReadyMeasurementEntry =
    activeMeasurementEntry?.status === READER_MEASUREMENT_STATUS_READY
      ? activeMeasurementEntry
      : null;
  const activeMeasurementStatus =
    activeMeasurementEntry?.status ?? READER_MEASUREMENT_STATUS_PENDING;
  const pageCount = activeReadyMeasurementEntry?.pageCount ?? 1;
  const restorePhase =
    settledRestoreCycleKey === activeRestoreCycleKey &&
    activeMeasurementStatus !== READER_MEASUREMENT_STATUS_PENDING
      ? READER_RESTORE_PHASE_SETTLED
      : READER_RESTORE_PHASE_RESTORING;

  const storeMeasurementEntry = useCallback((entry: ReaderMeasurementEntry) => {
    setMeasurementEntries((current) => {
      const next = new Map(current);
      next.set(entry.layoutKey, entry);
      return next;
    });
  }, []);

  const warnFailedMeasurement = useCallback(
    (layoutKey: string) => {
      if (warnedFailedMeasurementKeysRef.current.has(layoutKey)) {
        return;
      }

      warnedFailedMeasurementKeysRef.current.add(layoutKey);
      console.warn(
        `Reader measurement failed for ${layoutKey}. Falling back to chapter-level restore.`,
      );
    },
    [],
  );

  useLayoutEffect(() => {
    if (settleRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(settleRestoreFrameRef.current);
      settleRestoreFrameRef.current = null;
    }

    consumedRestoreIntentKeyRef.current = null;
    keepCommittedRestorePinnedRef.current = isStickyRestoreIntent(restoreIntent);
  }, [activeChapter.chapterId, restoreIntent]);

  useLayoutEffect(() => {
    if (!activePaginationLayoutKey || !activeMeasurementEntry) {
      return;
    }

    if (activeMeasurementEntry.status === READER_MEASUREMENT_STATUS_PENDING) {
      return;
    }

    const currentRestoreIntent = restoreIntentRef.current;
    const readyMeasurementEntry =
      activeMeasurementEntry.status === READER_MEASUREMENT_STATUS_READY
        ? activeMeasurementEntry
        : null;
    const visibleLocator = visibleLocatorRef.current;
    const restorePageResolution = resolvePageResolutionForLocator({
      activeChapterId: activeChapter.chapterId,
      locator: createLocatorFromRestoreIntent(currentRestoreIntent),
      measurementEntry: readyMeasurementEntry,
    });
    const visiblePageResolution = resolvePageResolutionForLocator({
      activeChapterId: activeChapter.chapterId,
      locator: visibleLocator,
      measurementEntry: readyMeasurementEntry,
    });
    const decision = resolvePaginationDecision({
      activeChapterId: activeChapter.chapterId,
      consumedRestoreIntentKey: consumedRestoreIntentKeyRef.current,
      currentPageIndex: currentPageIndexRef.current,
      keepRestorePinned: keepCommittedRestorePinnedRef.current,
      measurementStatus: activeMeasurementEntry.status,
      pageCount,
      restoreIntent: currentRestoreIntent,
      restorePageResolution,
      visibleLocatorChapterId: visibleLocator?.chapterId ?? null,
      visiblePageResolution,
    });

    if (decision.shouldWarnFailedMeasurement) {
      warnFailedMeasurement(activeMeasurementEntry.layoutKey);
    }

    setCurrentPageIndex((current) =>
      current === decision.nextPageIndex ? current : decision.nextPageIndex,
    );

    if (currentRestoreIntent && decision.shouldConsumeRestoreIntent) {
      consumedRestoreIntentKeyRef.current = currentRestoreIntent.key;
    }

    if (settleRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(settleRestoreFrameRef.current);
    }

    settleRestoreFrameRef.current = window.requestAnimationFrame(() => {
      settleRestoreFrameRef.current = null;
      setSettledRestoreCycleKey(activeRestoreCycleKey);
    });
  }, [
    activeChapter.chapterId,
    activeMeasurementEntry,
    activePaginationLayoutKey,
    activeRestoreCycleKey,
    pageCount,
    warnFailedMeasurement,
  ]);

  useEffect(() => {
    if (
      isBootstrapping ||
      restorePhase !== READER_RESTORE_PHASE_SETTLED ||
      !activeReadyMeasurementEntry
    ) {
      return;
    }

    const nextLocator = activeReadyMeasurementEntry.resolveLocator(currentPageIndex);

    if (!nextLocator) {
      return;
    }

    if (
      visibleLocatorRef.current?.chapterId === nextLocator.chapterId &&
      visibleLocatorRef.current?.blockId === nextLocator.blockId &&
      visibleLocatorRef.current?.textOffset === nextLocator.textOffset
    ) {
      return;
    }

    onVisibleLocatorChange({
      blockId: nextLocator.blockId,
      chapterId: nextLocator.chapterId,
      textOffset: nextLocator.textOffset,
    });
  }, [
    activeReadyMeasurementEntry,
    currentPageIndex,
    isBootstrapping,
    onVisibleLocatorChange,
    restorePhase,
  ]);

  const hasPreviousPage = currentPageIndex > 0;
  const hasNextPage = currentPageIndex < pageCount - 1;

  const stepPage = useCallback((direction: typeof PAGE_DIRECTION_BACKWARD | typeof PAGE_DIRECTION_FORWARD) => {
    if (isLoadingChapter) {
      return;
    }

    const isForward = direction === PAGE_DIRECTION_FORWARD;
    const hasNeighborPage = isForward ? hasNextPage : hasPreviousPage;

    if (hasNeighborPage) {
      keepCommittedRestorePinnedRef.current = false;
      setCurrentPageIndex((current) =>
        clamp(current + direction, 0, pageCount - 1),
      );
      return;
    }

    const nextChapterId = isForward
      ? activeChapter.nextChapterId
      : activeChapter.previousChapterId;
    if (nextChapterId) {
      onSelectChapter(nextChapterId, {
        edge: isForward
          ? READER_NAVIGATION_EDGE_START
          : READER_NAVIGATION_EDGE_END,
      });
    }
  }, [
    activeChapter.nextChapterId,
    activeChapter.previousChapterId,
    hasNextPage,
    hasPreviousPage,
    isLoadingChapter,
    onSelectChapter,
    pageCount,
  ]);

  const goToNextPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_FORWARD);
  }, [stepPage]);

  const goToPreviousPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_BACKWARD);
  }, [stepPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPanelOpen || isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === KEY_ARROW_RIGHT) {
        event.preventDefault();
        goToNextPage();
      }

      if (event.key === KEY_ARROW_LEFT) {
        event.preventDefault();
        goToPreviousPage();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToNextPage, goToPreviousPage, isPanelOpen]);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];

    if (!touch || isLoadingChapter || isPanelOpen) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || isLoadingChapter || isPanelOpen) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaY) > SWIPE_MAX_OFF_AXIS ||
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      return;
    }

    if (deltaX < 0) {
      goToNextPage();
      return;
    }

    goToPreviousPage();
  };

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
