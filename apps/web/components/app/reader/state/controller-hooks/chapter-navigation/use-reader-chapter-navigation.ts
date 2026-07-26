import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ReaderChapterPayload, ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  ReaderTraversalAction,
} from "@/features/reader/navigation";
import { READER_STATUS_READY } from "../../../shared/constants";
import type { ReaderControllerAuth, ReadyReaderPayload } from "../../../shared/types";
import { shouldRefreshChapterWindow } from "../../../shared/utils";
import { createRestoreIntentKey } from "./use-reader-chapter-navigation.helpers";
import { useBackgroundChapterRefresh } from "./use-background-chapter-refresh";
import { useBlockingChapterLoad } from "./use-blocking-chapter-load";

type UseReaderChapterNavigationInput = ReaderControllerAuth & {
  currentReadyChapterId: string | null;
  dispatchTraversal: Dispatch<ReaderTraversalAction>;
  libraryItemId: string;
  loadedChaptersById: Map<string, ReaderChapterPayload>;
  readyPayload: ReadyReaderPayload | null;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
  setVisibleLocator: Dispatch<SetStateAction<ReaderLocator | null>>;
};

type UseReaderChapterNavigationResult = {
  backgroundChapterId: null | string;
  commitVisibleChapter: (
    nextChapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  loadChapterWindow: (
    nextChapterId: string,
    target: ReaderNavigationTarget,
  ) => Promise<void>;
  navigateToChapter: (
    nextChapterId: string,
    target?: ReaderNavigationTarget,
  ) => void;
};

export function useReaderChapterNavigation({
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
}: UseReaderChapterNavigationInput): UseReaderChapterNavigationResult {
  const restoreIntentSequenceRef = useRef(0);
  const activeReadyChapterIdRef = useRef<string | null>(currentReadyChapterId);

  useEffect(() => {
    activeReadyChapterIdRef.current = currentReadyChapterId;
  }, [currentReadyChapterId]);

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
    [dispatchTraversal, nextRestoreIntentKey, setVisibleLocator],
  );

  const mergeReadyPayload = useCallback(
    (nextPayload: ReadyReaderPayload) => {
      setPayload((current) =>
        current.status === READER_STATUS_READY
          ? {
              ...nextPayload,
              progress: current.progress,
            }
          : nextPayload,
      );
    },
    [setPayload],
  );

  const { backgroundChapterId, cancelBackgroundRefresh, refreshChapterWindow } =
    useBackgroundChapterRefresh({
      activeReadyChapterIdRef,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      mergeReadyPayload,
      setPayload,
    });

  const { loadChapterWindow } = useBlockingChapterLoad({
    cancelBackgroundRefresh,
    commitVisibleChapter,
    dispatchTraversal,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    mergeReadyPayload,
    setPayload,
  });

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

      void loadChapterWindow(nextChapterId, target);
    },
    [loadChapterWindow, loadedChaptersById, switchToLoadedChapter],
  );

  return {
    backgroundChapterId,
    commitVisibleChapter,
    loadChapterWindow,
    navigateToChapter,
  };
}
