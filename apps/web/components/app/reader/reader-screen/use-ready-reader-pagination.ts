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
  hasPendingRestoreIntent,
  isStickyRestoreIntent,
  type ReaderNavigationTarget,
  type RestoreIntent,
} from "@/lib/reader-navigation";
import { createPaginationLayoutKey } from "@/lib/reader-pagination";
import type { ReaderMeasurementEntry } from "@/lib/reader-measurement";
import {
  PAGE_GAP,
  SWIPE_MAX_OFF_AXIS,
  SWIPE_THRESHOLD,
} from "./constants";
import type { PageBoxSize } from "./types";
import {
  clamp,
  createLocatorFromRestoreIntent,
  getBrowserViewportHeight,
  isInteractiveTarget,
} from "./utils";

type UseReadyReaderPaginationInput = {
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

type UseReadyReaderPaginationResult = {
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

export function useReadyReaderPagination({
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
}: UseReadyReaderPaginationInput): UseReadyReaderPaginationResult {
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
    activeMeasurementEntry?.status === "ready" ? activeMeasurementEntry : null;
  const activeMeasurementStatus =
    activeMeasurementEntry?.status ??
    (activePaginationLayoutKey ? "pending" : "pending");
  const pageCount = activeReadyMeasurementEntry?.pageCount ?? 1;
  const restorePhase =
    settledRestoreCycleKey === activeRestoreCycleKey &&
    activeMeasurementStatus !== "pending"
      ? "settled"
      : "restoring";

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

    if (activeMeasurementEntry.status === "pending") {
      return;
    }

    const currentRestoreIntent = restoreIntentRef.current;
    const readyMeasurementEntry =
      activeMeasurementEntry.status === "ready" ? activeMeasurementEntry : null;
    const maximumPageIndex = Math.max(0, pageCount - 1);
    let nextPageIndex = clamp(currentPageIndexRef.current, 0, maximumPageIndex);
    let shouldConsumeRestoreIntent = false;

    if (
      currentRestoreIntent &&
      hasPendingRestoreIntent(
        currentRestoreIntent,
        activeChapter.chapterId,
        consumedRestoreIntentKeyRef.current,
      )
    ) {
      if (activeMeasurementEntry.status === "failed") {
        warnFailedMeasurement(activeMeasurementEntry.layoutKey);
        nextPageIndex =
          currentRestoreIntent.kind === "edge-end" ? maximumPageIndex : 0;
        shouldConsumeRestoreIntent = true;
      } else if (currentRestoreIntent.kind === "block") {
        const restoreLocator = createLocatorFromRestoreIntent(currentRestoreIntent);
        const pageResolution = restoreLocator
          ? readyMeasurementEntry?.resolvePageIndex(restoreLocator) ?? {
              status: "missing-block" as const,
            }
          : {
              status: "missing-block" as const,
            };

        if (
          pageResolution.status === "block-start" ||
          pageResolution.status === "exact"
        ) {
          nextPageIndex = clamp(pageResolution.pageIndex, 0, maximumPageIndex);
        } else {
          nextPageIndex = 0;
        }

        shouldConsumeRestoreIntent = true;
      } else {
        nextPageIndex =
          currentRestoreIntent.kind === "edge-end" ? maximumPageIndex : 0;
        shouldConsumeRestoreIntent = true;
      }
    } else if (
      keepCommittedRestorePinnedRef.current &&
      currentRestoreIntent?.chapterId === activeChapter.chapterId &&
      isStickyRestoreIntent(currentRestoreIntent)
    ) {
      nextPageIndex =
        currentRestoreIntent.kind === "edge-end" ? maximumPageIndex : 0;
    } else if (
      readyMeasurementEntry &&
      visibleLocatorRef.current?.chapterId === activeChapter.chapterId
    ) {
      const pageResolution = readyMeasurementEntry.resolvePageIndex(
        visibleLocatorRef.current,
      );

      if (
        pageResolution.status === "block-start" ||
        pageResolution.status === "exact"
      ) {
        nextPageIndex = clamp(pageResolution.pageIndex, 0, maximumPageIndex);
      }
    } else if (activeMeasurementEntry.status === "failed") {
      warnFailedMeasurement(activeMeasurementEntry.layoutKey);
    }

    setCurrentPageIndex((current) =>
      current === nextPageIndex ? current : nextPageIndex,
    );

    if (currentRestoreIntent && shouldConsumeRestoreIntent) {
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
      restorePhase !== "settled" ||
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

  const goToNextPage = useCallback(() => {
    if (isLoadingChapter) {
      return;
    }

    if (hasNextPage) {
      keepCommittedRestorePinnedRef.current = false;
      setCurrentPageIndex((current) => clamp(current + 1, 0, pageCount - 1));
      return;
    }

    if (activeChapter.nextChapterId) {
      onSelectChapter(activeChapter.nextChapterId, {
        edge: "start",
      });
    }
  }, [
    activeChapter.nextChapterId,
    hasNextPage,
    isLoadingChapter,
    onSelectChapter,
    pageCount,
  ]);

  const goToPreviousPage = useCallback(() => {
    if (isLoadingChapter) {
      return;
    }

    if (hasPreviousPage) {
      keepCommittedRestorePinnedRef.current = false;
      setCurrentPageIndex((current) => clamp(current - 1, 0, pageCount - 1));
      return;
    }

    if (activeChapter.previousChapterId) {
      onSelectChapter(activeChapter.previousChapterId, {
        edge: "end",
      });
    }
  }, [
    activeChapter.previousChapterId,
    hasPreviousPage,
    isLoadingChapter,
    onSelectChapter,
    pageCount,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPanelOpen || isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextPage();
      }

      if (event.key === "ArrowLeft") {
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
    isBootstrapping || isLoadingChapter || restorePhase !== "settled";

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
