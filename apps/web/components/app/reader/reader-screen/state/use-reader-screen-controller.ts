import { useAuth } from "@clerk/nextjs";
import { useReducer, useState } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import {
  createInitialTraversalState,
  readerTraversalReducer,
} from "@/features/reader/navigation";
import type {
  InitialResumeBootstrapState,
  ReaderScreenControllerInput,
  ReaderScreenControllerResult,
} from "../shared/types";
import {
  READER_RESUME_PHASE_APPLIED,
  READER_RESUME_PHASE_SELECTING,
} from "../shared/constants";
import { normalizeReaderStatusPayload } from "../shared/utils";
import { useReaderChapterNavigation } from "./controller-hooks/chapter-navigation/use-reader-chapter-navigation";
import { useReaderOpenEvent } from "./controller-hooks/use-reader-open-event";
import { useReaderProcessingPoll } from "./controller-hooks/use-reader-processing-poll";
import { useReaderProgressSync } from "./controller-hooks/progress-sync/use-reader-progress-sync";
import { useReaderResumeBootstrap } from "./controller-hooks/use-reader-resume-bootstrap";
import { useReaderSessionTracking } from "./controller-hooks/session-tracking/use-reader-session-tracking";
import { useReaderViewState } from "./controller-hooks/use-reader-view-state";

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

  const {
    activeChapter,
    activeChapterId: currentReadyChapterId,
    displayLocator,
    loadedChaptersById,
    readyPayload,
    remotePersistenceEnabled,
    requestedChapterId,
  } = useReaderViewState({
    initialResume,
    payload,
    persistenceMode,
    traversal,
    visibleLocator,
  });

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

  useReaderProcessingPoll({
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payloadStatus: payload.status,
    requestedChapterId,
    setPayload,
  });

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
