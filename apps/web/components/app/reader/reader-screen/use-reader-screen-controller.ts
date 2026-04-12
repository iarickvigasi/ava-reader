import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderSessionPayload,
} from "@/lib/api-types";
import {
  createInitialTraversalState,
  readerTraversalReducer,
  resolveInitialNavigationTarget,
  resolveRequestedChapterId,
  resolveVisibleChapterId,
  type ReaderNavigationTarget,
} from "@/lib/reader-navigation";
import {
  createServerResumeSnapshot,
  readLocalReaderResumeSnapshot,
  selectPreferredReaderResumeSnapshot,
  writeLocalReaderResumeSnapshot,
} from "@/lib/reader-resume";
import type { ReaderResumeSnapshot } from "@/lib/reader-resume";
import type {
  InitialResumeBootstrapState,
  ReaderScreenControllerInput,
  ReaderScreenControllerResult,
  ReadyReaderPayload,
} from "./types";
import {
  READER_NAVIGATION_EDGE_START,
  READER_PERSISTENCE_MODE_REMOTE,
  READER_RESUME_PHASE_APPLIED,
  READER_RESUME_PHASE_APPLYING,
  READER_RESUME_PHASE_SELECTING,
  READER_STATUS_PROCESSING,
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
} from "./constants";
import {
  fetchReaderPayload,
  getOrCreateReaderClientInstanceId,
  heartbeatReaderSession,
  markReaderOpened,
  persistReaderProgress,
  startReaderSession,
  stopReaderSession,
} from "./reader-client";
import {
  createLocatorFromRestoreIntent,
  createLocatorKey,
  isAbortError,
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
  shouldRefreshChapterWindow,
} from "./utils";

const RESTORE_INTENT_KEY_SEPARATOR = ":";

function createRestoreIntentKey(input: {
  chapterId: string;
  sequence: number;
  target: ReaderNavigationTarget;
}) {
  return [
    input.chapterId,
    resolveRestoreIntentTargetSegment(input.target),
    input.sequence,
  ].join(RESTORE_INTENT_KEY_SEPARATOR);
}

function resolveRestoreIntentTargetSegment(target: ReaderNavigationTarget) {
  return target?.blockId ?? target?.edge ?? READER_NAVIGATION_EDGE_START;
}

export function useReaderScreenController({
  initialPayload,
  libraryItemId,
  persistenceMode,
}: ReaderScreenControllerInput): ReaderScreenControllerResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [payload, setPayload] = useState(() =>
    normalizeReaderStatusPayload(initialPayload),
  );
  const [backgroundChapterId, setBackgroundChapterId] = useState<string | null>(
    null,
  );
  const [visibleLocator, setVisibleLocator] = useState<ReaderLocator | null>(null);
  const [initialResume, setInitialResume] = useState<InitialResumeBootstrapState>(
    {
      phase: READER_RESUME_PHASE_SELECTING,
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
  const restartSessionTrackingRef = useRef<
    (() => Promise<ReaderSessionPayload | null>) | null
  >(null);
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
  const remotePersistenceEnabled =
    persistenceMode === READER_PERSISTENCE_MODE_REMOTE;
  const isLoadingChapter = traversal.pendingChapterId !== null;
  const isRefreshingWindow = backgroundChapterId !== null;
  const displayLocator = useMemo(() => {
    if (visibleLocator) {
      return visibleLocator;
    }

    const restoreLocator = createLocatorFromRestoreIntent(traversal.restoreIntent);
    return (
      restoreLocator ?? initialResume.snapshot?.locator ?? payload.progress.locator
    );
  }, [
    initialResume.snapshot,
    payload.progress.locator,
    traversal.restoreIntent,
    visibleLocator,
  ]);
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
      phase: READER_RESUME_PHASE_APPLYING,
      snapshot: selection.snapshot,
    });
  }, [initialPayload.progress, libraryItemId]);

  const nextRestoreIntentKey = useCallback(
    (nextChapterId: string, target: ReaderNavigationTarget) => {
      restoreIntentSequenceRef.current += 1;

      return createRestoreIntentKey({
        chapterId: nextChapterId,
        sequence: restoreIntentSequenceRef.current,
        target,
      });
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
      current.status === READER_STATUS_READY
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
      initialResume.phase !== READER_RESUME_PHASE_APPLYING ||
      payload.status !== READER_STATUS_READY ||
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
            current.phase === READER_RESUME_PHASE_APPLYING
              ? {
                  ...current,
                  phase: READER_RESUME_PHASE_APPLIED,
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
    if (payload.status !== READER_STATUS_PROCESSING) {
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
          current.status === READER_STATUS_READY
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
        payload.status === READER_STATUS_READY &&
        typeof document !== "undefined" &&
        document.visibilityState !== READER_VISIBILITY_HIDDEN
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
      payload.status !== READER_STATUS_READY ||
      typeof document === "undefined" ||
      document.visibilityState === READER_VISIBILITY_HIDDEN ||
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
      payload.status !== READER_STATUS_READY ||
      initialResume.phase !== READER_RESUME_PHASE_APPLIED ||
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
      payload.status !== READER_STATUS_READY ||
      initialResume.phase !== READER_RESUME_PHASE_APPLIED
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
      if (document.visibilityState === READER_VISIBILITY_HIDDEN) {
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
    if (!remotePersistenceEnabled || payload.status !== READER_STATUS_READY) {
      return;
    }

    void startReaderSessionTracking();
  }, [payload.status, remotePersistenceEnabled, startReaderSessionTracking]);

  useEffect(() => {
    if (!remotePersistenceEnabled) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === READER_VISIBILITY_HIDDEN) {
        void stopReaderSessionTracking(true);
        return;
      }

      if (payload.status === READER_STATUS_READY) {
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

  return {
    activeChapter,
    displayLocator,
    isBootstrapping: initialResume.phase !== READER_RESUME_PHASE_APPLIED,
    isLoadingChapter,
    isRefreshingWindow,
    navigateToChapter,
    payload,
    pendingChapterId: traversal.pendingChapterId,
    restoreIntent: traversal.restoreIntent,
    setVisibleLocator,
    visibleLocator,
  };
}
