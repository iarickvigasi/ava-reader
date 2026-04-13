import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { ReaderChapterPayload, ReaderLocator } from "@/lib/api-types";
import {
  createInitialTraversalState,
  readerTraversalReducer,
  resolveRequestedChapterId,
  resolveVisibleChapterId,
} from "@/lib/reader-navigation";
import type {
  InitialResumeBootstrapState,
  ReaderScreenControllerInput,
  ReaderScreenControllerResult,
} from "../shared/types";
import {
  READER_PERSISTENCE_MODE_REMOTE,
  READER_RESUME_PHASE_APPLIED,
  READER_RESUME_PHASE_SELECTING,
  READER_STATUS_POLL_INTERVAL_MS,
  READER_STATUS_PROCESSING,
} from "../shared/constants";
import { fetchReaderPayload } from "../data/reader-client";
import {
  createLocatorFromRestoreIntent,
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
} from "../shared/utils";
import { useReaderChapterNavigation } from "./controller-hooks/use-reader-chapter-navigation";
import { useReaderOpenEvent } from "./controller-hooks/use-reader-open-event";
import { useReaderProgressSync } from "./controller-hooks/use-reader-progress-sync";
import { useReaderResumeBootstrap } from "./controller-hooks/use-reader-resume-bootstrap";
import { useReaderSessionTracking } from "./controller-hooks/use-reader-session-tracking";

export function useReaderScreenController({
  initialPayload,
  libraryItemId,
  persistenceMode,
}: ReaderScreenControllerInput): ReaderScreenControllerResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [payload, setPayload] = useState(() =>
    normalizeReaderStatusPayload(initialPayload),
  );
  const [visibleLocator, setVisibleLocator] = useState<ReaderLocator | null>(null);
  const [initialResume, setInitialResume] = useState<InitialResumeBootstrapState>({
    phase: READER_RESUME_PHASE_SELECTING,
    snapshot: null,
  });
  const [traversal, dispatchTraversal] = useReducer(
    readerTraversalReducer,
    initialPayload,
    createInitialTraversalState,
  );

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
  const remotePersistenceEnabled =
    persistenceMode === READER_PERSISTENCE_MODE_REMOTE;

  const { backgroundChapterId, commitVisibleChapter, loadChapterWindow, navigateToChapter } =
    useReaderChapterNavigation({
      currentReadyChapterId,
      dispatchTraversal,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      loadedChaptersById,
      readyPayload,
      setPayload,
      setVisibleLocator,
    });

  useReaderOpenEvent({
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
  });

  useReaderResumeBootstrap({
    commitVisibleChapter,
    currentReadyChapterId,
    initialPayload,
    initialResume,
    libraryItemId,
    loadChapterWindow,
    loadedChaptersById,
    payload,
    setInitialResume,
    setVisibleLocator,
  });

  useReaderProgressSync({
    getToken,
    initialResumePhase: initialResume.phase,
    initialServerLocator: initialPayload.progress.locator,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payload,
    remotePersistenceEnabled,
    setPayload,
    visibleLocator,
  });

  useReaderSessionTracking({
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payloadStatus: payload.status,
    remotePersistenceEnabled,
  });

  /**
   * Loading book that is first opened in reader
   */
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
    }, READER_STATUS_POLL_INTERVAL_MS);

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

  const isLoadingChapter = traversal.pendingChapterId !== null;
  const isRefreshingWindow = backgroundChapterId !== null;

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
