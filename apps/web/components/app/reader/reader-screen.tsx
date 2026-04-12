"use client";
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
import { ChartIcon } from "@/components/app/shared/app-icons";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderInline,
  ReaderLocator,
  ReaderProgressPayload,
  ReaderSessionPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";
import {
  createPaginationLayoutKey,
} from "@/lib/reader-pagination";
import {
  countUniqueTocChapters,
  findActiveTocPathIds,
  resolveTocNavigationTarget,
} from "@/lib/reader-toc";
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
import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
  createReadyReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/lib/reader-measurement";
import {
  createServerResumeSnapshot,
  readLocalReaderResumeSnapshot,
  selectPreferredReaderResumeSnapshot,
  writeLocalReaderResumeSnapshot,
} from "@/lib/reader-resume";
import type { ReaderResumeSnapshot } from "@/lib/reader-resume";

const PAGE_GAP = 48;
const SWIPE_THRESHOLD = 56;
const SWIPE_MAX_OFF_AXIS = 72;

type ReaderScreenProps = {
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
  persistenceMode?: "local-only" | "remote";
};

type PageBoxSize = {
  height: number;
  width: number;
};

type ReadyReaderPayload = Extract<ReaderStatusPayload, { status: "READY" }>;

type InitialResumeBootstrapState = {
  phase: "selecting" | "applying" | "applied";
  snapshot: ReaderResumeSnapshot | null;
};

export function ReaderScreen({
  initialPayload,
  libraryItemId,
  persistenceMode = "remote",
}: ReaderScreenProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [fontScale, setFontScale] = useState(1);
  const [payload, setPayload] = useState(() =>
    normalizeReaderStatusPayload(initialPayload),
  );
  const [backgroundChapterId, setBackgroundChapterId] = useState<string | null>(
    null,
  );
  const [visibleLocator, setVisibleLocator] = useState<ReaderLocator | null>(null);
  const [initialResume, setInitialResume] = useState<InitialResumeBootstrapState>(
    {
      phase: "selecting",
      snapshot: null,
    },
  );
  const [traversal, dispatchTraversal] = useReducer(
    readerTraversalReducer,
    initialPayload,
    createInitialTraversalState,
  );
  const lastServerAckKeyRef = useRef<string | null>(
    createLocatorKey(initialPayload.progress.locator),
  );
  const pendingServerLocatorRef = useRef<ReaderLocator | null>(null);
  const pendingServerLocatorKeyRef = useRef<string | null>(null);
  const scheduledPersistTimeoutRef = useRef<number | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionClientInstanceIdRef = useRef<string | null>(null);
  const sessionHeartbeatIntervalRef = useRef<number | null>(null);
  const sessionStartAbortRef = useRef<AbortController | null>(null);
  const restartSessionTrackingRef = useRef<(() => Promise<ReaderSessionPayload | null>) | null>(null);
  const restoreIntentSequenceRef = useRef(0);
  const blockingRequestIdRef = useRef(0);
  const backgroundRequestIdRef = useRef(0);
  const blockingAbortRef = useRef<AbortController | null>(null);
  const backgroundAbortRef = useRef<AbortController | null>(null);
  const initialResumeApplyStartedRef = useRef(false);
  const openEventSentLibraryItemIdRef = useRef<string | null>(null);
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
    pendingChapterId: traversal.pendingChapterId,
    visibleChapterId: traversal.visibleChapterId,
  });
  const activeReadyChapterIdRef = useRef<string | null>(currentReadyChapterId);
  const remotePersistenceEnabled = persistenceMode === "remote";
  const isLoadingChapter = traversal.pendingChapterId !== null;
  const isRefreshingWindow = backgroundChapterId !== null;
  const displayLocator = useMemo(() => {
    if (visibleLocator) {
      return visibleLocator;
    }

    const restoreLocator = createLocatorFromRestoreIntent(traversal.restoreIntent);
    return restoreLocator ?? initialResume.snapshot?.locator ?? payload.progress.locator;
  }, [initialResume.snapshot, payload.progress.locator, traversal.restoreIntent, visibleLocator]);
  const getSessionClientInstanceId = useCallback(() => {
    if (sessionClientInstanceIdRef.current) {
      return sessionClientInstanceIdRef.current;
    }

    const clientInstanceId = getOrCreateReaderClientInstanceId();
    sessionClientInstanceIdRef.current = clientInstanceId;
    return clientInstanceId;
  }, []);

  useEffect(() => {
    if (sessionClientInstanceIdRef.current) {
      return;
    }

    sessionClientInstanceIdRef.current = getOrCreateReaderClientInstanceId();
  }, []);

  useEffect(() => {
    activeReadyChapterIdRef.current = currentReadyChapterId;
  }, [currentReadyChapterId]);

  useEffect(() => {
    return () => {
      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
      }
      if (sessionHeartbeatIntervalRef.current !== null) {
        window.clearInterval(sessionHeartbeatIntervalRef.current);
      }
      sessionStartAbortRef.current?.abort();
      blockingAbortRef.current?.abort();
      backgroundAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    if (openEventSentLibraryItemIdRef.current === libraryItemId) {
      return;
    }

    openEventSentLibraryItemIdRef.current = libraryItemId;

    void markReaderOpened({
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
    }).catch(() => {
      // Ignore transient failures; reader access and local progress should continue.
    });
  }, [getToken, isLoaded, isSignedIn, libraryItemId]);

  useEffect(() => {
    initialResumeApplyStartedRef.current = false;
    setVisibleLocator(null);

    const selection = selectPreferredReaderResumeSnapshot({
      localSnapshot: readLocalReaderResumeSnapshot(libraryItemId),
      serverSnapshot: createServerResumeSnapshot(initialPayload.progress),
    });

    setInitialResume({
      phase: "applying",
      snapshot: selection.snapshot,
    });
  }, [initialPayload.progress, libraryItemId]);

  const nextRestoreIntentKey = useCallback(
    (nextChapterId: string, target: ReaderNavigationTarget) => {
      restoreIntentSequenceRef.current += 1;

      return `${nextChapterId}:${target?.blockId ?? target?.edge ?? "start"}:${restoreIntentSequenceRef.current}`;
    },
    [],
  );

  const commitVisibleChapter = useCallback(
    (nextChapterId: string, target: ReaderNavigationTarget) => {
      setVisibleLocator(null);
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
    async (nextChapterId: string, target: ReaderNavigationTarget) => {
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

      try {
        const nextPayload = await fetchReaderPayload({
          chapterId: nextChapterId,
          getToken,
          isLoaded,
          isSignedIn,
          libraryItemId,
          signal: controller.signal,
        });

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
      } catch (error: unknown) {
        if (!isAbortError(error)) {
          throw error;
        }
      } finally {
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
      }
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
    (nextChapterId: string, target: ReaderNavigationTarget) => {
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
    (nextChapterId: string, target: ReaderNavigationTarget = undefined) => {
      if (loadedChaptersById.has(nextChapterId)) {
        switchToLoadedChapter(nextChapterId, target);
        return;
      }

      loadChapterWindow(nextChapterId, target);
    },
    [loadChapterWindow, loadedChaptersById, switchToLoadedChapter],
  );

  useEffect(() => {
    if (
      initialResume.phase !== "applying" ||
      payload.status !== "READY" ||
      initialResumeApplyStartedRef.current
    ) {
      return;
    }

    initialResumeApplyStartedRef.current = true;

    let isCancelled = false;

    const applyInitialResume = async () => {
      const targetChapterId =
        initialResume.snapshot?.locator.chapterId ?? payload.activeChapterId;
      const target =
        initialResume.snapshot?.locator
          ? {
              blockId: initialResume.snapshot.locator.blockId,
              textOffset: initialResume.snapshot.locator.textOffset,
            }
          : resolveInitialNavigationTarget(payload);
      const needsFetch =
        !loadedChaptersById.has(targetChapterId) ||
        currentReadyChapterId !== targetChapterId;

      try {
        if (needsFetch) {
          await loadChapterWindow(targetChapterId, target);
        } else {
          commitVisibleChapter(targetChapterId, target);
        }
      } finally {
        if (!isCancelled) {
          setInitialResume((current) =>
            current.phase === "applying"
              ? {
                  ...current,
                  phase: "applied",
                }
              : current,
          );
        }
      }
    };

    void applyInitialResume();

    return () => {
      isCancelled = true;
    };
  }, [
    commitVisibleChapter,
    currentReadyChapterId,
    initialResume.phase,
    initialResume.snapshot,
    loadChapterWindow,
    loadedChaptersById,
    payload,
  ]);

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
      });
    }, 3_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
    requestedChapterId,
  ]);

  const persistPendingProgress = useCallback(
    async (locator: ReaderLocator, keepalive = false) => {
      if (!remotePersistenceEnabled) {
        return null;
      }

      const locatorKey = createLocatorKey(locator);

      if (!locatorKey || locatorKey === lastServerAckKeyRef.current) {
        if (pendingServerLocatorKeyRef.current === locatorKey) {
          pendingServerLocatorRef.current = null;
          pendingServerLocatorKeyRef.current = null;
        }

        return null;
      }

      try {
        const nextProgress = await persistReaderProgress({
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          locator,
        });
        const ackKey = createLocatorKey(nextProgress.locator);
        lastServerAckKeyRef.current = ackKey;

        if (pendingServerLocatorKeyRef.current === ackKey) {
          pendingServerLocatorRef.current = null;
          pendingServerLocatorKeyRef.current = null;
        }

        setPayload((current) =>
          current.status === "READY"
            ? {
                ...current,
                progress: nextProgress,
              }
            : current,
        );

        return nextProgress;
      } catch (error) {
        if (!keepalive) {
          throw error;
        }

        return null;
      }
    },
    [getToken, isLoaded, isSignedIn, libraryItemId, remotePersistenceEnabled],
  );

  const sendReaderSessionHeartbeat = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;

    if (!remotePersistenceEnabled || !sessionId) {
      return null;
    }

    try {
      const session = await heartbeatReaderSession({
        clientInstanceId: getSessionClientInstanceId(),
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        sessionId,
      });

      if (
        session.endedAt &&
        payload.status === "READY" &&
        typeof document !== "undefined" &&
        document.visibilityState !== "hidden"
      ) {
        activeSessionIdRef.current = null;
        void restartSessionTrackingRef.current?.();
      }

      return session;
    } catch {
      return null;
    }
  }, [
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
    remotePersistenceEnabled,
  ]);

  const stopReaderSessionTracking = useCallback(
    async (keepalive = false) => {
      if (sessionHeartbeatIntervalRef.current !== null) {
        window.clearInterval(sessionHeartbeatIntervalRef.current);
        sessionHeartbeatIntervalRef.current = null;
      }

      sessionStartAbortRef.current?.abort();
      sessionStartAbortRef.current = null;

      const sessionId = activeSessionIdRef.current;
      activeSessionIdRef.current = null;

      if (!remotePersistenceEnabled || !sessionId) {
        return null;
      }

      try {
        return await stopReaderSession({
          clientInstanceId: getSessionClientInstanceId(),
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          sessionId,
        });
      } catch {
        return null;
      }
    },
    [
      getSessionClientInstanceId,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      remotePersistenceEnabled,
    ],
  );

  const startReaderSessionTracking = useCallback(async () => {
    if (
      !remotePersistenceEnabled ||
      payload.status !== "READY" ||
      typeof document === "undefined" ||
      document.visibilityState === "hidden" ||
      activeSessionIdRef.current ||
      sessionStartAbortRef.current
    ) {
      return null;
    }

    const controller = new AbortController();
    sessionStartAbortRef.current = controller;

    try {
      const session = await startReaderSession({
        clientInstanceId: getSessionClientInstanceId(),
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return null;
      }

      sessionStartAbortRef.current = null;

      if (document.hidden) {
        activeSessionIdRef.current = session.sessionId;
        await stopReaderSessionTracking(true);
        return null;
      }

      activeSessionIdRef.current = session.sessionId;

      if (sessionHeartbeatIntervalRef.current !== null) {
        window.clearInterval(sessionHeartbeatIntervalRef.current);
      }

      sessionHeartbeatIntervalRef.current = window.setInterval(() => {
        void sendReaderSessionHeartbeat();
      }, 30_000);

      return session;
    } catch {
      sessionStartAbortRef.current = null;
      return null;
    }
  }, [
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
    remotePersistenceEnabled,
    sendReaderSessionHeartbeat,
    stopReaderSessionTracking,
  ]);

  useEffect(() => {
    restartSessionTrackingRef.current = startReaderSessionTracking;

    return () => {
      if (restartSessionTrackingRef.current === startReaderSessionTracking) {
        restartSessionTrackingRef.current = null;
      }
    };
  }, [startReaderSessionTracking]);

  useEffect(() => {
    if (
      payload.status !== "READY" ||
      initialResume.phase !== "applied" ||
      !visibleLocator
    ) {
      return;
    }

    const nextSnapshot = {
      locator: visibleLocator,
      savedAt: new Date().toISOString(),
      version: 2,
    } satisfies ReaderResumeSnapshot;
    writeLocalReaderResumeSnapshot(libraryItemId, nextSnapshot);

    if (!remotePersistenceEnabled) {
      return;
    }

    const locatorKey = createLocatorKey(visibleLocator);
    pendingServerLocatorRef.current = visibleLocator;
    pendingServerLocatorKeyRef.current = locatorKey;

    if (!locatorKey || locatorKey === lastServerAckKeyRef.current) {
      pendingServerLocatorRef.current = null;
      pendingServerLocatorKeyRef.current = null;
      return;
    }

    if (scheduledPersistTimeoutRef.current !== null) {
      window.clearTimeout(scheduledPersistTimeoutRef.current);
    }

    scheduledPersistTimeoutRef.current = window.setTimeout(() => {
      scheduledPersistTimeoutRef.current = null;
      const locatorToPersist = pendingServerLocatorRef.current;

      if (!locatorToPersist) {
        return;
      }

      void persistPendingProgress(locatorToPersist);
    }, 900);

    return () => {
      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
      }
    };
  }, [
    getToken,
    initialResume.phase,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload.status,
    persistPendingProgress,
    remotePersistenceEnabled,
    visibleLocator,
  ]);

  useEffect(() => {
    if (
      !remotePersistenceEnabled ||
      payload.status !== "READY" ||
      initialResume.phase !== "applied"
    ) {
      return;
    }

    const flushPendingProgress = () => {
      const locatorToPersist = pendingServerLocatorRef.current;
      const pendingLocatorKey = pendingServerLocatorKeyRef.current;

      if (
        !locatorToPersist ||
        !pendingLocatorKey ||
        pendingLocatorKey === lastServerAckKeyRef.current
      ) {
        return;
      }

      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
        scheduledPersistTimeoutRef.current = null;
      }

      void persistPendingProgress(locatorToPersist, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingProgress();
      }
    };

    window.addEventListener("pagehide", flushPendingProgress);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushPendingProgress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    initialResume.phase,
    payload.status,
    persistPendingProgress,
    remotePersistenceEnabled,
  ]);

  useEffect(() => {
    if (!remotePersistenceEnabled || payload.status !== "READY") {
      return;
    }

    void startReaderSessionTracking();
  }, [payload.status, remotePersistenceEnabled, startReaderSessionTracking]);

  useEffect(() => {
    if (!remotePersistenceEnabled) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void stopReaderSessionTracking(true);
        return;
      }

      if (payload.status === "READY") {
        void startReaderSessionTracking();
      }
    };

    const handlePageHide = () => {
      void stopReaderSessionTracking(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [
    payload.status,
    remotePersistenceEnabled,
    startReaderSessionTracking,
    stopReaderSessionTracking,
  ]);

  useEffect(() => {
    return () => {
      void stopReaderSessionTracking(true);
    };
  }, [stopReaderSessionTracking]);

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
            displayLocator={displayLocator}
            fontScale={fontScale}
            isBootstrapping={initialResume.phase !== "applied"}
            isLoadingChapter={isLoadingChapter}
            isRefreshingWindow={isRefreshingWindow}
            libraryItemId={libraryItemId}
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
            onVisibleLocatorChange={setVisibleLocator}
            payload={payload}
            pendingChapterId={traversal.pendingChapterId}
            restoreIntent={traversal.restoreIntent}
            visibleLocator={visibleLocator}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReadyReader({
  activeChapter,
  displayLocator,
  fontScale,
  isBootstrapping,
  isLoadingChapter,
  isRefreshingWindow,
  libraryItemId,
  onDecreaseFont,
  onIncreaseFont,
  onSelectChapter,
  onVisibleLocatorChange,
  payload,
  pendingChapterId,
  restoreIntent,
  visibleLocator,
}: {
  activeChapter: ReaderChapterPayload;
  displayLocator: ReaderLocator | null;
  fontScale: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
  libraryItemId: string;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
}) {
  const { activePanel, closePanel } = useReaderUi();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const isContentsOpen = activePanel === "contents";
  const isPanelOpen = isSidebarOpen || isContentsOpen;
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

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPanelOpen]);

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
            {isBootstrapping ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
                Restoring your last page...
              </p>
            ) : isLoadingChapter ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
                Loading chapter...
              </p>
            ) : isRefreshingWindow ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/35">
                Preloading nearby chapter...
              </p>
            ) : null}

            <div
              className="relative min-h-0 flex-1 overflow-hidden px-3 py-5 sm:px-5 sm:py-6 md:px-6"
              style={{
                touchAction: "pan-y",
              }}
              onTouchEnd={handleTouchEnd}
              onTouchStart={handleTouchStart}
            >
              <div ref={pageBoxRef} className="h-full w-full overflow-hidden">
                <ReaderArticle
                  blocks={activeChapter.blocks}
                  pageHeight={pageBoxSize.height}
                  style={articleStyle}
                />
              </div>
              {shouldMaskArticle ? (
                <div className="pointer-events-none absolute inset-0 bg-paper/55 backdrop-blur-[2px]" />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-3 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
                <span>{payload.progress.completionPercent}% complete</span>
                <span>
                  Page {Math.min(currentPageIndex + 1, pageCount)} of {pageCount} in chapter
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isSidebarOpen ? (
        <ReaderSidebarOverlay
          activeChapter={activeChapter}
          fontScale={fontScale}
          isLoadingChapter={isLoadingChapter}
          onClose={() => setIsSidebarOpen(false)}
          onDecreaseFont={onDecreaseFont}
          onIncreaseFont={onIncreaseFont}
          payload={payload}
        />
      ) : null}

      {isContentsOpen ? (
        <ReaderContentsOverlay
          activeChapterId={activeChapter.chapterId}
          activeLocator={displayLocator}
          onClose={closePanel}
          onSelectChapter={(chapterId, target) => {
            closePanel();
            onSelectChapter(chapterId, target);
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
          onMeasurement={storeMeasurementEntry}
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
  fontScale,
  isLoadingChapter,
  onClose,
  onDecreaseFont,
  onIncreaseFont,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  fontScale: number;
  isLoadingChapter: boolean;
  onClose: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
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
            <SectionLabel>Reader controls</SectionLabel>
            <div className="rounded-3xl border border-line/45 bg-white/45 p-4">
              <p className="font-(--font-reader) text-lg leading-7 text-ink">
                Open `Contents` from the left rail to jump between chapters
                while keeping this panel focused on reading controls.
              </p>
            </div>
          </div>

          {isLoadingChapter ? (
            <div className="mt-6 border-t border-line/40 pt-5">
              <p className="font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/40">
                Switching chapters...
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ReaderContentsOverlay({
  activeChapterId,
  activeLocator,
  onClose,
  onSelectChapter,
  payload,
  pendingChapterId,
}: {
  activeChapterId: string;
  activeLocator: ReaderLocator | null;
  onClose: () => void;
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
}) {
  const activePathIds = useMemo(
    () =>
      new Set(
        findActiveTocPathIds(payload.toc, {
          activeBlockId: activeLocator?.blockId ?? null,
          activeChapterId,
        }),
      ),
    [activeChapterId, activeLocator?.blockId, payload.toc],
  );
  const chapterCount = useMemo(
    () => countUniqueTocChapters(payload.toc),
    [payload.toc],
  );

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
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close contents panel"
        className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SectionLabel>Contents</SectionLabel>
                  <h2 className="mt-4 font-(--font-reader) text-[2rem] leading-[0.95] tracking-[-0.04em] text-title">
                    {payload.book.title}
                  </h2>
                  {payload.book.author ? (
                    <p className="mt-4 font-(--font-ui) text-[0.82rem] uppercase tracking-[0.18em] text-title/70">
                      {payload.book.author}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line/45 bg-white/55 text-ink transition hover:bg-white md:hidden"
                  onClick={onClose}
                >
                  <span className="font-(--font-ui) text-lg leading-none">×</span>
                </button>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/55">
                    {payload.progress.completionPercent}% completed
                  </span>
                  <span className="font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
                    {chapterCount} chapters
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-line/20">
                  <div
                    className="h-full rounded-full bg-title transition-[width]"
                    style={{
                      width: `${clamp(payload.progress.completionPercent, 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <nav className="mt-8 min-h-0 flex-1 overflow-auto pb-8 pr-3">
                <div className="space-y-3">
                  {payload.toc.map((entry) => (
                    <ReaderContentsTreeNode
                      key={entry.id}
                      activeChapterId={activeChapterId}
                      activePathIds={activePathIds}
                      depth={0}
                      entry={entry}
                      onSelectChapter={onSelectChapter}
                      pendingChapterId={pendingChapterId}
                    />
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReaderContentsTreeNode({
  activeChapterId,
  activePathIds,
  depth,
  entry,
  onSelectChapter,
  pendingChapterId,
}: {
  activeChapterId: string;
  activePathIds: Set<string>;
  depth: number;
  entry: Extract<ReaderStatusPayload, { status: "READY" }>["toc"][number];
  onSelectChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  pendingChapterId: string | null;
}) {
  const isActivePath = activePathIds.has(entry.id);
  const isPending = Boolean(entry.chapterId && pendingChapterId === entry.chapterId);
  const navigationTarget = resolveTocNavigationTarget(entry);
  const chapterId = entry.chapterId;
  const isClickable = Boolean(chapterId && navigationTarget);
  const isCurrentSection = Boolean(
    entry.blockId && isActivePath && entry.chapterId === activeChapterId,
  );
  const isCurrentChapter = !isCurrentSection && entry.chapterId === activeChapterId;

  return (
    <div className="space-y-3">
      <div
        className="border-l border-title/10 pl-4"
        style={{ marginLeft: `${depth * 14}px` }}
      >
        {isClickable && chapterId && navigationTarget ? (
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 text-left"
            onClick={() => onSelectChapter(chapterId, navigationTarget)}
          >
            <span
              className={cn(
                "min-w-0 font-(--font-reader) leading-6 transition",
                depth === 0 ? "text-[0.98rem]" : "text-[0.92rem]",
                isCurrentSection
                  ? "font-semibold text-title"
                  : isCurrentChapter || isActivePath
                    ? "text-title"
                    : depth > 0
                      ? "text-title/62 hover:text-title"
                      : "text-title/78 hover:text-title",
              )}
            >
              {entry.label}
            </span>
            <span className="shrink-0 pt-1 font-(--font-ui) text-[0.62rem] uppercase tracking-[0.16em] text-ink/35">
              {isPending
                ? "Loading"
                : isCurrentSection
                  ? "Current"
                  : entry.blockId
                    ? "Section"
                    : isCurrentChapter
                      ? "Chapter"
                      : ""}
            </span>
          </button>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "min-w-0 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.14em]",
                isActivePath ? "text-title/72" : "text-ink/42",
              )}
            >
              {entry.label}
            </span>
          </div>
        )}
      </div>

      {entry.children.length > 0 ? (
        <div className="space-y-3">
          {entry.children.map((child) => (
            <ReaderContentsTreeNode
              key={child.id}
              activeChapterId={activeChapterId}
              activePathIds={activePathIds}
              depth={depth + 1}
              entry={child}
              onSelectChapter={onSelectChapter}
              pendingChapterId={pendingChapterId}
            />
          ))}
        </div>
      ) : null}
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
  articleRef?: Ref<HTMLElement>;
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
  onMeasurement,
  pageBoxHeight,
  pageBoxWidth,
}: {
  chapters: ReaderChapterPayload[];
  fontScale: number;
  libraryItemId: string;
  onMeasurement: (entry: ReaderMeasurementEntry) => void;
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

  const createLayoutKey = useCallback(
    (chapterId: string) =>
      createPaginationLayoutKey({
        chapterId,
        fontScale,
        libraryItemId,
        viewportHeight: pageBoxHeight,
        viewportWidth: pageBoxWidth,
      }),
    [fontScale, libraryItemId, pageBoxHeight, pageBoxWidth],
  );

  const publishPendingMeasurements = useCallback(() => {
    for (const chapter of chapters) {
      onMeasurement(
        createPendingReaderMeasurementEntry({
          chapterId: chapter.chapterId,
          layoutKey: createLayoutKey(chapter.chapterId),
        }),
      );
    }
  }, [
    chapters,
    createLayoutKey,
    onMeasurement,
  ]);

  const measurePreloadedChapters = useCallback(() => {
    for (const chapter of chapters) {
      const article = articleRefs.current.get(chapter.chapterId) ?? null;
      const pageBox = pageBoxRefs.current.get(chapter.chapterId) ?? null;
      const layoutKey = createLayoutKey(chapter.chapterId);

      if (!article || !pageBox) {
        onMeasurement(
          createPendingReaderMeasurementEntry({
            chapterId: chapter.chapterId,
            layoutKey,
          }),
        );
        continue;
      }

      try {
        onMeasurement(
          createReadyReaderMeasurementEntry({
            article,
            chapterId: chapter.chapterId,
            layoutKey,
            pageBox,
            pageGap: PAGE_GAP,
          }),
        );
      } catch {
        onMeasurement(
          createFailedReaderMeasurementEntry({
            chapterId: chapter.chapterId,
            layoutKey,
          }),
        );
      }
    }
  }, [
    chapters,
    createLayoutKey,
    onMeasurement,
  ]);

  useLayoutEffect(() => {
    publishPendingMeasurements();
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
  }, [chapters, measurePreloadedChapters, publishPendingMeasurements]);

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
    "data-reader-block-kind": block.kind,
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
      <div className="w-full rounded-4xl border border-line/60 bg-surface/95 p-8 shadow-(--shadow-card) backdrop-blur sm:p-10 xl:p-12">
        <p className="font-(--font-ui) text-[1rem] uppercase tracking-[0.24em] text-title/88 sm:text-[1.12rem]">
          Reader
        </p>
        <h1 className="mt-5 font-(--font-reader) text-[2.8rem] leading-[0.94] tracking-[-0.04em] text-title sm:text-[4rem]">
          {payload.book.title}
        </h1>
        <p className="mt-6 max-w-2xl font-(--font-reader) text-[1.18rem] leading-8 text-ink/88 sm:text-[1.45rem] sm:leading-10">
          {payload.message}
        </p>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-5 border-t border-line/45 pt-6">
          <a
            href="/app"
            className="inline-flex min-h-11 items-center rounded-[14px] border border-brand-fill bg-brand-fill px-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-foreground shadow-(--shadow-card) transition hover:bg-brand-fill-strong"
          >
            Back to home
          </a>
          <span
            className={cn(
              "font-(--font-ui) text-[1.1rem] uppercase tracking-[0.24em] sm:text-[1.35rem]",
              payload.status === "FAILED"
                ? "text-danger"
                : payload.status === "UNSUPPORTED"
                  ? "text-title/82"
                  : "text-ink/60",
            )}
          >
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

async function markReaderOpened(input: {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  libraryItemId: string;
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
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/open`,
    {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("The reader open event could not be persisted.");
  }
}

async function persistReaderProgress(input: {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  keepalive?: boolean;
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
      keepalive: input.keepalive,
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

async function startReaderSession(input: {
  clientInstanceId: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  libraryItemId: string;
  signal?: AbortSignal;
}) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: "POST",
    path: "session",
    signal: input.signal,
  });
}

async function heartbeatReaderSession(input: {
  clientInstanceId: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  libraryItemId: string;
  sessionId: string;
}) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      sessionId: input.sessionId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: "PATCH",
    path: "session",
  });
}

async function stopReaderSession(input: {
  clientInstanceId: string;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  keepalive?: boolean;
  libraryItemId: string;
  sessionId: string;
}) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      sessionId: input.sessionId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    keepalive: input.keepalive,
    libraryItemId: input.libraryItemId,
    method: "POST",
    path: "session/stop",
  });
}

async function performReaderSessionRequest(input: {
  body?: Record<string, unknown>;
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  keepalive?: boolean;
  libraryItemId: string;
  method: "PATCH" | "POST";
  path: "session" | "session/stop";
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

  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/${input.path}`,
    {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input.body ?? {}),
      keepalive: input.keepalive,
      signal: input.signal,
    },
  );

  if (!response.ok) {
    throw new Error("Reader session tracking could not be saved.");
  }

  return (await response.json()) as ReaderSessionPayload;
}

const READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY =
  "ava-reader:reader-session-client-instance-id";

function getOrCreateReaderClientInstanceId() {
  if (typeof window === "undefined") {
    return createReaderClientInstanceId();
  }

  try {
    const existingClientInstanceId = window.sessionStorage.getItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
    );

    if (existingClientInstanceId) {
      return existingClientInstanceId;
    }

    const nextClientInstanceId = createReaderClientInstanceId();
    window.sessionStorage.setItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
      nextClientInstanceId,
    );
    return nextClientInstanceId;
  } catch {
    return createReaderClientInstanceId();
  }
}

function createReaderClientInstanceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createLocatorKey(locator: ReaderLocator | null) {
  if (!locator) {
    return null;
  }

  return `${locator.chapterId}:${locator.blockId}:${locator.textOffset}`;
}

function createLocatorFromRestoreIntent(restoreIntent: RestoreIntent | null) {
  if (!restoreIntent || restoreIntent.kind !== "block") {
    return null;
  }

  return {
    blockId: restoreIntent.blockId,
    chapterId: restoreIntent.chapterId,
    textOffset: restoreIntent.textOffset,
  } satisfies ReaderLocator;
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
