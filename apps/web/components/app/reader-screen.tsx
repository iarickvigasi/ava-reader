"use client";

import Link from "next/link";
import type {
  CSSProperties,
  ReactNode,
  Ref,
  TouchEvent as ReactTouchEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ChartIcon,
} from "@/components/app/app-icons";
import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderInline,
  ReaderLocator,
  ReaderProgressPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";
import {
  createPaginationLayoutKey,
  measurePaginationSnapshot,
  resolvePageIndexFromPaginationSnapshot,
  type PaginationSnapshot,
} from "@/lib/reader-pagination";
import {
  createInitialTraversalState,
  hasPendingRestoreIntent,
  isStickyRestoreIntent,
  readerTraversalReducer,
  resolveInitialNavigationTarget,
  resolveRequestedChapterId,
  resolveVisibleChapterId,
} from "@/lib/reader-navigation";
import type {
  ReaderNavigationTarget,
  RestoreIntent,
} from "@/lib/reader-navigation";

const PAGE_GAP = 48;
const SWIPE_THRESHOLD = 56;
const SWIPE_MAX_OFF_AXIS = 72;

type ReaderScreenProps = {
  initialChapterParam?: string | null;
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
};

type PageBoxSize = {
  height: number;
  width: number;
};

type ReadyReaderPayload = Extract<ReaderStatusPayload, { status: "READY" }>;

export function ReaderScreen({
  initialChapterParam,
  initialPayload,
  libraryItemId,
}: ReaderScreenProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [fontScale, setFontScale] = useState(1);
  const [payload, setPayload] = useState(() =>
    normalizeReaderStatusPayload(initialPayload),
  );
  const [backgroundChapterId, setBackgroundChapterId] = useState<string | null>(
    null,
  );
  const [activeLocator, setActiveLocator] = useState<ReaderLocator | null>(
    initialPayload.progress.locator,
  );
  const [traversal, dispatchTraversal] = useReducer(
    readerTraversalReducer,
    {
      initialChapterParam,
      initialPayload,
    },
    ({
      initialChapterParam: nextInitialChapterParam,
      initialPayload: nextInitialPayload,
    }) =>
      createInitialTraversalState(nextInitialPayload, nextInitialChapterParam),
  );
  const lastPersistedKeyRef = useRef<string | null>(
    createLocatorKey(initialPayload.progress.locator),
  );
  const restoreIntentSequenceRef = useRef(0);
  const blockingRequestIdRef = useRef(0);
  const backgroundRequestIdRef = useRef(0);
  const blockingAbortRef = useRef<AbortController | null>(null);
  const backgroundAbortRef = useRef<AbortController | null>(null);
  const readyPayload = isReadyReaderPayload(payload) ? payload : null;
  const loadedChaptersById = useMemo(
    () =>
      readyPayload
        ? new Map(
            readyPayload.chapters.map((chapter) => [chapter.chapterId, chapter]),
          )
        : new Map<string, ReaderChapterPayload>(),
    [readyPayload],
  );
  const activeChapterId = readyPayload
    ? resolveVisibleChapterId(readyPayload, traversal.visibleChapterId)
    : null;
  const activeChapter = activeChapterId
    ? loadedChaptersById.get(activeChapterId) ?? null
    : null;
  const currentReadyChapterId = activeChapterId;
  const requestedChapterId = resolveRequestedChapterId({
    initialChapterParam,
    pendingChapterId: traversal.pendingChapterId,
    visibleChapterId: traversal.visibleChapterId,
  });
  const activeReadyChapterIdRef = useRef<string | null>(currentReadyChapterId);
  const isLoadingChapter = traversal.pendingChapterId !== null;
  const isRefreshingWindow = backgroundChapterId !== null;

  useEffect(() => {
    activeReadyChapterIdRef.current = currentReadyChapterId;
  }, [currentReadyChapterId]);

  useEffect(() => {
    return () => {
      blockingAbortRef.current?.abort();
      backgroundAbortRef.current?.abort();
    };
  }, []);

  const replaceChapterUrl = useCallback((nextChapterId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    if (nextUrl.searchParams.get("chapter") === nextChapterId) {
      return;
    }

    nextUrl.searchParams.set("chapter", nextChapterId);
    window.history.replaceState(
      window.history.state,
      "",
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
    );
  }, []);

  useEffect(() => {
    if (payload.status !== "READY" || !currentReadyChapterId) {
      return;
    }

    replaceChapterUrl(currentReadyChapterId);
  }, [currentReadyChapterId, payload.status, replaceChapterUrl]);

  const nextRestoreIntentKey = useCallback(
    (nextChapterId: string, target: ReaderNavigationTarget) => {
      restoreIntentSequenceRef.current += 1;

      return `${nextChapterId}:${target?.blockId ?? target?.edge ?? "start"}:${restoreIntentSequenceRef.current}`;
    },
    [],
  );

  const commitVisibleChapter = useCallback(
    (nextChapterId: string, target: ReaderNavigationTarget) => {
      activeReadyChapterIdRef.current = nextChapterId;
      dispatchTraversal({
        chapterId: nextChapterId,
        key: nextRestoreIntentKey(nextChapterId, target),
        target,
        type: "commit-chapter",
      });
    },
    [nextRestoreIntentKey],
  );

  const mergeReadyPayload = useCallback((nextPayload: ReadyReaderPayload) => {
    setPayload((current) =>
      current.status === "READY"
        ? {
            ...nextPayload,
            progress: current.progress,
          }
        : nextPayload,
    );
  }, []);

  const refreshChapterWindow = useCallback(
    (nextChapterId: string) => {
      const requestId = backgroundRequestIdRef.current + 1;
      backgroundRequestIdRef.current = requestId;
      backgroundAbortRef.current?.abort();

      const controller = new AbortController();
      backgroundAbortRef.current = controller;
      setBackgroundChapterId(nextChapterId);

      void fetchReaderPayload({
        chapterId: nextChapterId,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
      })
        .then((nextPayload) => {
          if (
            controller.signal.aborted ||
            backgroundRequestIdRef.current !== requestId ||
            activeReadyChapterIdRef.current !== nextChapterId
          ) {
            return;
          }

          const normalizedPayload = normalizeReaderStatusPayload(nextPayload);

          if (isReadyReaderPayload(normalizedPayload)) {
            mergeReadyPayload(normalizedPayload);
            return;
          }

          setPayload(normalizedPayload);
          setActiveLocator(normalizedPayload.progress.locator);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            throw error;
          }
        })
        .finally(() => {
          if (
            backgroundRequestIdRef.current === requestId &&
            backgroundAbortRef.current === controller
          ) {
            backgroundAbortRef.current = null;
            setBackgroundChapterId((current) =>
              current === nextChapterId ? null : current,
            );
          }
        });
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      mergeReadyPayload,
    ],
  );

  const loadChapterWindow = useCallback(
    (
      nextChapterId: string,
      target:
        | {
            blockId?: string | null;
            edge?: "end" | "start";
          }
        | undefined,
    ) => {
      const requestId = blockingRequestIdRef.current + 1;
      blockingRequestIdRef.current = requestId;
      blockingAbortRef.current?.abort();
      backgroundAbortRef.current?.abort();
      backgroundAbortRef.current = null;
      setBackgroundChapterId(null);

      const controller = new AbortController();
      blockingAbortRef.current = controller;
      dispatchTraversal({
        chapterId: nextChapterId,
        type: "start-pending",
      });

      void fetchReaderPayload({
        chapterId: nextChapterId,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
      })
        .then((nextPayload) => {
          if (
            controller.signal.aborted ||
            blockingRequestIdRef.current !== requestId
          ) {
            return;
          }

          const normalizedPayload = normalizeReaderStatusPayload(nextPayload);

          if (isReadyReaderPayload(normalizedPayload)) {
            mergeReadyPayload(normalizedPayload);
            commitVisibleChapter(normalizedPayload.activeChapterId, target);
            return;
          }

          setPayload(normalizedPayload);
          setActiveLocator(normalizedPayload.progress.locator);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            throw error;
          }
        })
        .finally(() => {
          if (
            blockingRequestIdRef.current === requestId &&
            blockingAbortRef.current === controller
          ) {
            blockingAbortRef.current = null;
            dispatchTraversal({
              chapterId: nextChapterId,
              type: "clear-pending",
            });
          }
        });
    },
    [
      commitVisibleChapter,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      mergeReadyPayload,
    ],
  );

  const switchToLoadedChapter = useCallback(
    (
      nextChapterId: string,
      target:
        | {
            blockId?: string | null;
            edge?: "end" | "start";
          }
        | undefined,
    ) => {
      if (!readyPayload) {
        return;
      }

      commitVisibleChapter(nextChapterId, target);

      if (shouldRefreshChapterWindow(readyPayload, nextChapterId)) {
        refreshChapterWindow(nextChapterId);
      }
    },
    [commitVisibleChapter, readyPayload, refreshChapterWindow],
  );

  const navigateToChapter = useCallback(
    (
      nextChapterId: string,
      target:
        | {
            blockId?: string | null;
            edge?: "end" | "start";
          }
        | undefined = undefined,
    ) => {
      if (loadedChaptersById.has(nextChapterId)) {
        switchToLoadedChapter(nextChapterId, target);
        return;
      }

      loadChapterWindow(nextChapterId, target);
    },
    [loadChapterWindow, loadedChaptersById, switchToLoadedChapter],
  );

  useEffect(() => {
    if (payload.status !== "PROCESSING") {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchReaderPayload({
        chapterId: requestedChapterId ?? undefined,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
      }).then((nextPayload) => {
        const normalizedPayload = normalizeReaderStatusPayload(nextPayload);

        setPayload(normalizedPayload);
        if (isReadyReaderPayload(normalizedPayload)) {
          setActiveLocator(normalizedPayload.progress.locator);
          commitVisibleChapter(
            normalizedPayload.activeChapterId,
            resolveInitialNavigationTarget(
              normalizedPayload,
              initialChapterParam,
            ),
          );
        }
      });
    }, 3_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    commitVisibleChapter,
    getToken,
    initialChapterParam,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
    requestedChapterId,
  ]);

  useEffect(() => {
    if (payload.status !== "READY" || !activeLocator) {
      return;
    }

    const locatorKey = createLocatorKey(activeLocator);
    if (!locatorKey || locatorKey === lastPersistedKeyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistReaderProgress({
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        locator: activeLocator,
      }).then((nextProgress) => {
        lastPersistedKeyRef.current = createLocatorKey(nextProgress.locator);
        setPayload((current) =>
          current.status === "READY"
            ? {
                ...current,
                progress: nextProgress,
              }
            : current,
        );
      });
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeLocator,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
  ]);

  const readerStyle = useMemo(
    () =>
      ({
        "--reader-font-scale": fontScale,
      }) as CSSProperties,
    [fontScale],
  );

  return (
    <div className="bg-paper text-ink" style={readerStyle}>
      <div className="mx-auto min-h-screen max-w-375 md:pl-20">
        {payload.status !== "READY" ? (
          <ReaderStatusState payload={payload} />
        ) : activeChapter ? (
          <ReadyReader
            activeChapter={activeChapter}
            activeLocator={activeLocator}
            fontScale={fontScale}
            isLoadingChapter={isLoadingChapter}
            isRefreshingWindow={isRefreshingWindow}
            libraryItemId={libraryItemId}
            onActiveLocatorChange={setActiveLocator}
            onDecreaseFont={() =>
              setFontScale((current) =>
                Math.max(0.85, roundFontScale(current - 0.1)),
              )
            }
            onIncreaseFont={() =>
              setFontScale((current) =>
                Math.min(1.35, roundFontScale(current + 0.1)),
              )
            }
            onSelectChapter={navigateToChapter}
            payload={payload}
            pendingChapterId={traversal.pendingChapterId}
            restoreIntent={traversal.restoreIntent}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReadyReader({
  activeChapter,
  activeLocator,
  fontScale,
  isLoadingChapter,
  isRefreshingWindow,
  libraryItemId,
  onActiveLocatorChange,
  onDecreaseFont,
  onIncreaseFont,
  onSelectChapter,
  payload,
  pendingChapterId,
  restoreIntent,
}: {
  activeChapter: ReaderChapterPayload;
  activeLocator: ReaderLocator | null;
  fontScale: number;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
  libraryItemId: string;
  onActiveLocatorChange: (locator: ReaderLocator | null) => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onSelectChapter: (
    chapterId: string,
    target?:
      | {
          blockId?: string | null;
          edge?: "end" | "start";
        }
      | undefined,
  ) => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
}) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [pageBoxSize, setPageBoxSize] = useState<PageBoxSize>({
    height: 0,
    width: 0,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const consumedRestoreIntentKeyRef = useRef<string | null>(null);
  const currentPageIndexRef = useRef(0);
  const activeLocatorRef = useRef<ReaderLocator | null>(activeLocator);
  const restoreIntentRef = useRef<RestoreIntent | null>(restoreIntent);
  const paginationSnapshotsRef = useRef(new Map<string, PaginationSnapshot>());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const keepCommittedRestorePinnedRef = useRef(false);

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  useEffect(() => {
    activeLocatorRef.current = activeLocator;
  }, [activeLocator]);

  useEffect(() => {
    restoreIntentRef.current = restoreIntent;
  }, [restoreIntent]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

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

  const cachePaginationSnapshot = useCallback((snapshot: PaginationSnapshot) => {
    paginationSnapshotsRef.current.set(snapshot.layoutKey, snapshot);
  }, []);

  const applyPaginationSnapshot = useCallback(
    (snapshot: PaginationSnapshot) => {
      const currentRestoreIntent = restoreIntentRef.current;
      const nextPageIndex = resolvePageIndexFromPaginationSnapshot({
        activeChapterId: activeChapter.chapterId,
        activeLocator: activeLocatorRef.current,
        consumedRestoreIntentKey: consumedRestoreIntentKeyRef.current,
        currentPageIndex: currentPageIndexRef.current,
        keepRestorePinned: keepCommittedRestorePinnedRef.current,
        restoreIntent: currentRestoreIntent,
        snapshot,
      });

      setPageCount((current) =>
        current === snapshot.pageCount ? current : snapshot.pageCount,
      );
      setCurrentPageIndex((current) =>
        current === nextPageIndex ? current : nextPageIndex,
      );

      if (
        currentRestoreIntent &&
        hasPendingRestoreIntent(
          currentRestoreIntent,
          activeChapter.chapterId,
          consumedRestoreIntentKeyRef.current,
        )
      ) {
        consumedRestoreIntentKeyRef.current = currentRestoreIntent.key;
      }
    },
    [activeChapter.chapterId],
  );

  const measureLivePaginationSnapshot = useCallback(() => {
    if (!activePaginationLayoutKey) {
      return null;
    }

    const snapshot = measurePaginationSnapshot({
      article: articleRef.current,
      currentPageIndex: currentPageIndexRef.current,
      layoutKey: activePaginationLayoutKey,
      pageBox: pageBoxRef.current,
      pageGap: PAGE_GAP,
    });

    if (snapshot) {
      cachePaginationSnapshot(snapshot);
    }

    return snapshot;
  }, [activePaginationLayoutKey, cachePaginationSnapshot]);

  const reconcilePagination = useCallback(() => {
    const snapshot = measureLivePaginationSnapshot();
    if (!snapshot) {
      return;
    }

    applyPaginationSnapshot(snapshot);
  }, [applyPaginationSnapshot, measureLivePaginationSnapshot]);

  useLayoutEffect(() => {
    consumedRestoreIntentKeyRef.current = null;
    keepCommittedRestorePinnedRef.current = isStickyRestoreIntent(restoreIntent);
  }, [restoreIntent]);

  useLayoutEffect(() => {
    if (!activePaginationLayoutKey) {
      return;
    }

    const snapshot =
      paginationSnapshotsRef.current.get(activePaginationLayoutKey) ??
      measureLivePaginationSnapshot();

    if (!snapshot) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- This pre-paint seed prevents the old chapter page from flashing before pagination is restored.
    applyPaginationSnapshot(snapshot);
  }, [
    activeChapter.blocks,
    activePaginationLayoutKey,
    applyPaginationSnapshot,
    measureLivePaginationSnapshot,
  ]);

  useEffect(() => {
    let frameId = window.requestAnimationFrame(() => {
      reconcilePagination();
    });

    const article = articleRef.current;
    const pageBox = pageBoxRef.current;

    if (!article || !pageBox) {
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        reconcilePagination();
      });
    });

    resizeObserver.observe(article);
    resizeObserver.observe(pageBox);

    const images = Array.from(article.querySelectorAll("img"));
    const onImageLoad = () => {
      reconcilePagination();
    };

    for (const image of images) {
      image.addEventListener("load", onImageLoad);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      for (const image of images) {
        image.removeEventListener("load", onImageLoad);
      }
    };
  }, [
    activeChapter.blocks,
    activeChapter.chapterId,
    activeLocator,
    fontScale,
    restoreIntent?.key,
    pageBoxSize.height,
    pageBoxSize.width,
    reconcilePagination,
  ]);

  useEffect(() => {
    const pageBox = pageBoxRef.current;
    const article = articleRef.current;

    if (!pageBox || !article) {
      return;
    }

    const blockElements = Array.from(
      article.querySelectorAll<HTMLElement>("[data-reader-block='true']"),
    );

    if (blockElements.length === 0) {
      return;
    }

    const pageBoxWidth = Math.floor(pageBox.clientWidth);
    if (pageBoxWidth <= 0) {
      return;
    }

    const pageSpan = pageBoxWidth + PAGE_GAP;
    const pageBoxRect = pageBox.getBoundingClientRect();
    const pageStart = currentPageIndex * pageSpan;
    const visibleThreshold = pageStart + 12;

    let selected = blockElements[0];

    for (const element of blockElements) {
      const elementPageOffset = getAbsoluteLeft(
        element,
        pageBoxRect.left,
        pageSpan,
        currentPageIndex,
      );

      if (elementPageOffset <= visibleThreshold) {
        selected = element;
        continue;
      }

      break;
    }

    const blockId = selected.dataset.blockId;
    if (!blockId) {
      return;
    }

    const nextLocator = {
      blockId,
      chapterId: activeChapter.chapterId,
      textOffset: 0,
    };

    if (
      activeLocatorRef.current?.chapterId === nextLocator.chapterId &&
      activeLocatorRef.current?.blockId === nextLocator.blockId &&
      activeLocatorRef.current?.textOffset === nextLocator.textOffset
    ) {
      return;
    }

    onActiveLocatorChange({
      blockId: nextLocator.blockId,
      chapterId: nextLocator.chapterId,
      textOffset: nextLocator.textOffset,
    });
  }, [
    activeChapter.chapterId,
    currentPageIndex,
    onActiveLocatorChange,
    pageCount,
    pageBoxSize.width,
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
      if (isSidebarOpen || isInteractiveTarget(event.target)) {
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
  }, [goToNextPage, goToPreviousPage, isSidebarOpen]);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];

    if (!touch || isLoadingChapter || isSidebarOpen) {
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

    if (!start || isLoadingChapter || isSidebarOpen) {
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

  const atBookEnd =
    !activeChapter.nextChapterId && currentPageIndex === pageCount - 1;
  const atBookStart =
    !activeChapter.previousChapterId && currentPageIndex === 0;

  return (
    <>
      <div
        ref={rootRef}
        className="px-4 pb-5 pt-8 sm:px-6 md:px-7 md:pt-8 lg:px-8"
        style={{
          height: availableHeight > 0 ? `${availableHeight}px` : undefined,
        }}
      >
        <section className="mx-auto flex h-full max-w-312 min-w-0 flex-col">
          <div className="flex items-start justify-between gap-6">
            <ReaderHeader activeChapter={activeChapter} payload={payload} />
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line/50 bg-white/70 px-4 font-ui text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-[0_14px_34px_rgba(31,27,24,0.08)] transition hover:bg-white"
              onClick={() => setIsSidebarOpen(true)}
            >
              <ChartIcon className="size-4" />
              Reader panel
            </button>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 sm:mt-8">
            {isLoadingChapter ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
                Loading chapter...
              </p>
            ) : isRefreshingWindow ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/35">
                Preloading nearby chapter...
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex flex-wrap items-center gap-3 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
                <span>
                  Page {Math.min(currentPageIndex + 1, pageCount)} of {pageCount}
                </span>
                <span>{payload.progress.completionPercent}% complete</span>
                <span>Use keyboard arrows or swipe</span>
              </div>
            </div>

            <div
              ref={viewportRef}
              className="relative min-h-0 flex-1 overflow-hidden px-3 py-5 sm:px-5 sm:py-6 md:px-6"
              style={{
                touchAction: "pan-y",
              }}
              onTouchEnd={handleTouchEnd}
              onTouchStart={handleTouchStart}
            >
              <div ref={pageBoxRef} className="h-full w-full overflow-hidden">
                <ReaderArticle
                  articleRef={articleRef}
                  blocks={activeChapter.blocks}
                  pageHeight={pageBoxSize.height}
                  style={articleStyle}
                />
              </div>
              {isLoadingChapter ? (
                <div className="pointer-events-none absolute inset-0 bg-paper/55 backdrop-blur-[2px]" />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
                {activeLocator
                  ? `Tracking block ${activeLocator.blockId.split("::").at(-1)}`
                  : "Tracking current page"}
              </p>
              <div className="flex flex-wrap items-center gap-4 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
                <span>{atBookStart ? "At book start" : "Previous crosses chapters"}</span>
                <span>{atBookEnd ? "At book end" : "Next crosses chapters"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isSidebarOpen ? (
        <ReaderSidebarOverlay
          activeChapter={activeChapter}
          activeChapterId={activeChapter.chapterId}
          activeLocator={activeLocator}
          fontScale={fontScale}
          isLoadingChapter={isLoadingChapter}
          onClose={() => setIsSidebarOpen(false)}
          onDecreaseFont={onDecreaseFont}
          onIncreaseFont={onIncreaseFont}
          onSelectChapter={(chapterId) => {
            setIsSidebarOpen(false);
            onSelectChapter(chapterId, { edge: "start" });
          }}
          payload={payload}
          pendingChapterId={pendingChapterId}
        />
      ) : null}

      {pageBoxSize.width > 0 && pageBoxSize.height > 0 ? (
        <ReaderPaginationPreloader
          chapters={payload.chapters}
          fontScale={fontScale}
          libraryItemId={libraryItemId}
          onSnapshot={cachePaginationSnapshot}
          pageBoxHeight={pageBoxSize.height}
          pageBoxWidth={pageBoxSize.width}
        />
      ) : null}
    </>
  );
}

function getBrowserViewportHeight() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function ReaderSidebarOverlay({
  activeChapter,
  activeChapterId,
  activeLocator,
  fontScale,
  isLoadingChapter,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
  onSelectChapter,
  payload,
  pendingChapterId,
}: {
  activeChapter: ReaderChapterPayload;
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  fontScale: number;
  isLoadingChapter: boolean;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onSelectChapter: (chapterId: string) => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close reader panel"
        className="absolute inset-0 bg-black/25 backdrop-blur-md"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full justify-end p-3 sm:p-5">
        <div className="flex h-full w-full max-w-md flex-col rounded-4xl border border-line/70 bg-surface/95 p-5 shadow-(--shadow-card) backdrop-blur xl:max-w-120 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.18em] text-ink/45">
                Reader
              </p>
              <p className="mt-2 font-(--font-reader) text-2xl leading-none text-ink">
                {activeChapter.label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-line/50 bg-soft-fill/45 px-3 py-1.5 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.14em] text-ink/55">
                {payload.progress.completionPercent}%
              </div>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 text-ink transition hover:bg-soft-tone-fill"
                onClick={onClose}
              >
                <span className="font-(--font-ui) text-lg leading-none">×</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
              onClick={onDecreaseFont}
            >
              A-
            </button>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-line/45 bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
              onClick={onIncreaseFont}
            >
              A+
            </button>
            <p className="ml-2 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/45">
              Type {Math.round(fontScale * 100)}%
            </p>
          </div>

          <div className="mt-8 min-h-0 flex-1 space-y-3">
            <SectionLabel>Contents</SectionLabel>
            <nav className="h-full max-h-full space-y-1 overflow-auto pr-1">
              {payload.toc.map((entry) => {
                const isActive = entry.chapterId === activeChapterId;
                const isPending = pendingChapterId === entry.chapterId;

                return (
                  <button
                    key={entry.chapterId}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                      isActive
                        ? "bg-soft-tone-fill text-ink"
                        : "text-ink/70 hover:bg-soft-fill/75 hover:text-ink",
                    )}
                    onClick={() => onSelectChapter(entry.chapterId)}
                  >
                    <span className="min-w-0 font-(--font-ui) text-sm leading-5">
                      {entry.label}
                    </span>
                    {isPending ? (
                      <span className="ml-3 shrink-0 font-(--font-ui) text-[0.65rem] uppercase tracking-[0.14em] text-ink/45">
                        ...
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/40 pt-5">
            <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
              {activeLocator
                ? `Tracking block ${activeLocator.blockId.split("::").at(-1)}`
                : "Tracking current page"}
            </p>
            {isLoadingChapter ? (
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
                Switching chapters...
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReaderHeader({
  activeChapter,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
}) {
  return (
    <header className="min-w-0 flex-1 pt-1">
      <h1 className="max-w-full truncate font-(--font-ui) text-[1.05rem] leading-none tracking-[0.01em] text-title sm:text-[1.2rem]">
        {formatReaderHeaderLine(payload, activeChapter)}
      </h1>
    </header>
  );
}

function ReaderArticle({
  articleRef,
  blocks,
  pageHeight,
  style,
}: {
  articleRef: Ref<HTMLElement>;
  blocks: ReaderBlock[];
  pageHeight: number;
  style?: CSSProperties;
}) {
  return (
    <article
      ref={articleRef}
      className="h-full space-y-8 [column-fill:auto] sm:space-y-10 md:space-y-11"
      style={style}
    >
      {blocks.map((block) => (
        <ReaderBlockView
          key={block.id}
          block={block}
          pageHeight={pageHeight}
        />
      ))}
    </article>
  );
}

function ReaderPaginationPreloader({
  chapters,
  fontScale,
  libraryItemId,
  onSnapshot,
  pageBoxHeight,
  pageBoxWidth,
}: {
  chapters: ReaderChapterPayload[];
  fontScale: number;
  libraryItemId: string;
  onSnapshot: (snapshot: PaginationSnapshot) => void;
  pageBoxHeight: number;
  pageBoxWidth: number;
}) {
  const articleRefs = useRef(new Map<string, HTMLElement>());
  const pageBoxRefs = useRef(new Map<string, HTMLDivElement>());

  const setArticleRef = useCallback(
    (chapterId: string, node: HTMLElement | null) => {
      if (node) {
        articleRefs.current.set(chapterId, node);
        return;
      }

      articleRefs.current.delete(chapterId);
    },
    [],
  );

  const setPageBoxRef = useCallback(
    (chapterId: string, node: HTMLDivElement | null) => {
      if (node) {
        pageBoxRefs.current.set(chapterId, node);
        return;
      }

      pageBoxRefs.current.delete(chapterId);
    },
    [],
  );

  const articleStyle = useMemo(
    () =>
      ({
        columnGap: `${PAGE_GAP}px`,
        columnWidth: `${pageBoxWidth}px`,
        height: `${pageBoxHeight}px`,
      }) as CSSProperties,
    [pageBoxHeight, pageBoxWidth],
  );

  const measurePreloadedChapters = useCallback(() => {
    for (const chapter of chapters) {
      const snapshot = measurePaginationSnapshot({
        article: articleRefs.current.get(chapter.chapterId) ?? null,
        currentPageIndex: 0,
        layoutKey: createPaginationLayoutKey({
          chapterId: chapter.chapterId,
          fontScale,
          libraryItemId,
          viewportHeight: pageBoxHeight,
          viewportWidth: pageBoxWidth,
        }),
        pageBox: pageBoxRefs.current.get(chapter.chapterId) ?? null,
        pageGap: PAGE_GAP,
      });

      if (snapshot) {
        onSnapshot(snapshot);
      }
    }
  }, [
    chapters,
    fontScale,
    libraryItemId,
    onSnapshot,
    pageBoxHeight,
    pageBoxWidth,
  ]);

  useLayoutEffect(() => {
    measurePreloadedChapters();

    const resizeObserver = new ResizeObserver(() => {
      measurePreloadedChapters();
    });
    const images: HTMLImageElement[] = [];
    const onImageLoad = () => {
      measurePreloadedChapters();
    };

    for (const chapter of chapters) {
      const article = articleRefs.current.get(chapter.chapterId);
      const pageBox = pageBoxRefs.current.get(chapter.chapterId);

      if (article) {
        resizeObserver.observe(article);

        for (const image of article.querySelectorAll<HTMLImageElement>("img")) {
          image.addEventListener("load", onImageLoad);
          images.push(image);
        }
      }

      if (pageBox) {
        resizeObserver.observe(pageBox);
      }
    }

    return () => {
      resizeObserver.disconnect();

      for (const image of images) {
        image.removeEventListener("load", onImageLoad);
      }
    };
  }, [chapters, measurePreloadedChapters]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-[-200vw] top-0 z-[-1] overflow-hidden opacity-0"
      style={{
        visibility: "hidden",
      }}
    >
      <div className="space-y-4">
        {chapters.map((chapter) => (
          <div
            key={chapter.chapterId}
            ref={(node) => {
              setPageBoxRef(chapter.chapterId, node);
            }}
            className="overflow-hidden"
            style={{
              height: `${pageBoxHeight}px`,
              width: `${pageBoxWidth}px`,
            }}
          >
            <ReaderArticle
              articleRef={(node) => {
                setArticleRef(chapter.chapterId, node);
              }}
              blocks={chapter.blocks}
              pageHeight={pageBoxHeight}
              style={articleStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReaderBlockView({
  block,
  pageHeight,
}: {
  block: ReaderBlock;
  pageHeight: number;
}) {
  const sharedProps = {
    "data-block-id": block.id,
    "data-reader-block": "true",
    id: block.anchorId ?? undefined,
  } as const;

  if (block.kind === "heading") {
    const headingClassName =
      "break-inside-avoid-column font-(--font-reader) text-[calc(1.7rem*var(--reader-font-scale))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale))]";

    if (block.level === 1) {
      return (
        <h1 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h1>
      );
    }

    if (block.level === 2) {
      return (
        <h2 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h2>
      );
    }

    if (block.level === 3) {
      return (
        <h3 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h3>
      );
    }

    if (block.level === 4) {
      return (
        <h4 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h4>
      );
    }

    if (block.level === 5) {
      return (
        <h5 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h5>
      );
    }

    return (
      <h6 {...sharedProps} className={headingClassName}>
        <InlineContent inlines={block.inlines} />
      </h6>
    );
  }

  if (block.kind === "blockquote") {
    return (
      <blockquote
        {...sharedProps}
        className="border-l border-line/60 pl-5 font-(--font-reader) text-[calc(1.18rem*var(--reader-font-scale))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale))]"
      >
        <InlineContent inlines={block.inlines} />
      </blockquote>
    );
  }

  if (block.kind === "list") {
    const listClassName = cn(
      "space-y-4 pl-6 font-(--font-reader) text-[calc(1.12rem*var(--reader-font-scale))] leading-loose text-ink sm:text-[calc(1.28rem*var(--reader-font-scale))]",
      block.ordered ? "list-decimal" : "list-disc",
    );

    if (block.ordered) {
      return (
        <ol {...sharedProps} className={listClassName}>
          {block.items.map((item) => (
            <li key={item.id}>
              <InlineContent inlines={item.inlines} />
            </li>
          ))}
        </ol>
      );
    }

    return (
      <ul {...sharedProps} className={listClassName}>
        {block.items.map((item) => (
          <li key={item.id}>
            <InlineContent inlines={item.inlines} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === "image") {
    const imageMaxHeight =
      pageHeight > 0
        ? `${Math.max(160, Math.floor(pageHeight - 64))}px`
        : undefined;

    return (
      <figure {...sharedProps} className="break-inside-avoid-column space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={block.alt ?? ""}
          className="w-full rounded-[22px] border border-line/30 object-contain"
          src={block.src}
          style={{
            maxHeight: imageMaxHeight,
          }}
        />
        {block.alt ? (
          <figcaption className="font-(--font-ui) text-sm text-ink/55">
            {block.alt}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <p
      {...sharedProps}
      className="font-(--font-reader) text-[calc(1.16rem*var(--reader-font-scale))] leading-loose tracking-[-0.01em] text-ink sm:text-[calc(1.34rem*var(--reader-font-scale))]"
    >
      <InlineContent inlines={block.inlines} />
    </p>
  );
}

function InlineContent({ inlines }: { inlines: ReaderInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === "image") {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={inline.alt ?? ""}
              className="mx-1 inline-block max-h-8 max-w-32 align-middle"
              src={inline.src}
            />
          );

          return inline.href ? (
            <a
              key={key}
              href={inline.href}
              className="underline decoration-line/60 underline-offset-4"
            >
              {image}
            </a>
          ) : (
            <span key={key}>{image}</span>
          );
        }

        const content = (
          <span
            className={cn(
              inline.bold && "font-bold",
              inline.italic && "italic",
            )}
          >
            {inline.text}
          </span>
        );

        return inline.href ? (
          <a
            key={key}
            href={inline.href}
            className="underline decoration-line/60 underline-offset-4 hover:text-title"
          >
            {content}
          </a>
        ) : (
          <span key={key}>{content}</span>
        );
      })}
    </>
  );
}

function ReaderStatusState({
  payload,
}: {
  payload: Exclude<ReaderStatusPayload, { status: "READY" }>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-16 sm:px-8">
      <div className="w-full rounded-4xl border border-line/40 bg-[#fcf5f0] p-8 shadow-[0_18px_50px_rgba(31,27,24,0.06)] sm:p-10">
        <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.18em] text-ink/45">
          Reader
        </p>
        <h1 className="mt-4 font-(--font-reader) text-4xl leading-none text-title sm:text-5xl">
          {payload.book.title}
        </h1>
        <p className="mt-6 max-w-2xl font-(--font-reader) text-xl leading-9 text-ink/85 sm:text-2xl">
          {payload.message}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center rounded-[14px] border border-brand-fill bg-brand-fill px-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-foreground shadow-(--shadow-card) transition hover:bg-brand-fill-strong"
          >
            Back to home
          </Link>
          <span className="font-(--font-ui) text-xs uppercase tracking-[0.14em] text-ink/45">
            {payload.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-(--font-ui) text-[0.68rem] uppercase tracking-[0.18em] text-ink/45">
      {children}
    </p>
  );
}

function shouldRefreshChapterWindow(
  payload: ReadyReaderPayload,
  chapterId: string,
) {
  const chapterIndex = payload.chapters.findIndex(
    (chapter) => chapter.chapterId === chapterId,
  );

  if (chapterIndex === -1) {
    return false;
  }

  const chapter = payload.chapters[chapterIndex];

  return Boolean(
    (chapterIndex === 0 && chapter.previousChapterId) ||
      (chapterIndex === payload.chapters.length - 1 && chapter.nextChapterId),
  );
}

function formatReaderHeaderLine(
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  activeChapter: ReaderChapterPayload,
) {
  const chapterLabel = formatReaderChapterLabel(activeChapter.label);
  if (payload.book.author) {
    return `${payload.book.title}, ${payload.book.author} - ${chapterLabel}`;
  }

  return `${payload.book.title} - ${chapterLabel}`;
}

function formatReaderChapterLabel(label: string) {
  return label.replace(/\bChapter\s+(\d+)\b/i, (_, chapterNumber: string) => {
    return `Chapter ${chapterNumber.padStart(2, "0")}`;
  });
}

async function fetchReaderPayload(input: {
  chapterId?: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  libraryItemId: string;
  signal?: AbortSignal;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const url = new URL(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader`,
  );

  if (input.chapterId) {
    url.searchParams.set("chapter", input.chapterId);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error("The reader payload could not be loaded.");
  }

  return (await response.json()) as ReaderStatusPayload;
}

async function persistReaderProgress(input: {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  libraryItemId: string;
  locator: ReaderLocator;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/progress`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        locator: input.locator,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Reader progress could not be saved.");
  }

  return (await response.json()) as ReaderProgressPayload;
}

function createLocatorKey(locator: ReaderLocator | null) {
  if (!locator) {
    return null;
  }

  return `${locator.chapterId}:${locator.blockId}:${locator.textOffset}`;
}

function roundFontScale(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isReadyReaderPayload(
  payload: ReaderStatusPayload,
): payload is ReadyReaderPayload {
  return (
    payload.status === "READY" &&
    Array.isArray(payload.chapters) &&
    Array.isArray(payload.toc)
  );
}

function normalizeReaderStatusPayload(
  payload: ReaderStatusPayload,
): ReaderStatusPayload {
  if (payload.status !== "READY") {
    return payload;
  }

  const candidate = payload as ReaderStatusPayload & {
    activeChapterId?: unknown;
    chapters?: unknown;
    toc?: unknown;
  };

  if (isReadyReaderPayload(candidate)) {
    return payload;
  }

  return {
    book: candidate.book,
    message: "The reader payload was incomplete. Please reload and try again.",
    progress: candidate.progress,
    status: "FAILED",
  };
}

function getAbsoluteLeft(
  element: HTMLElement,
  viewportLeft: number,
  pageSpan: number,
  currentPageIndex: number,
) {
  return (
    element.getBoundingClientRect().left -
    viewportLeft +
    currentPageIndex * pageSpan
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, [contenteditable='true']",
    ),
  );
}
