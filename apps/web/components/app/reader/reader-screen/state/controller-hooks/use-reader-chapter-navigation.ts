import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  ReaderTraversalAction,
} from "@/lib/reader-navigation";
import { fetchReaderPayload } from "../../data/reader-client";
import { READER_STATUS_READY } from "../../shared/constants";
import type { ReaderControllerAuth, ReadyReaderPayload } from "../../shared/types";
import {
  isAbortError,
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
  shouldRefreshChapterWindow,
} from "../../shared/utils";
import {
  createRestoreIntentKey,
  shouldApplyBackgroundResponse,
  shouldApplyBlockingResponse,
  shouldFinalizeNavigationRequest,
} from "./use-reader-chapter-navigation.helpers";

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
  const [backgroundChapterId, setBackgroundChapterId] = useState<string | null>(
    null,
  );
  const restoreIntentSequenceRef = useRef(0);
  const blockingRequestIdRef = useRef(0);
  const backgroundRequestIdRef = useRef(0);
  const activeReadyChapterIdRef = useRef<string | null>(currentReadyChapterId);
  const blockingAbortRef = useRef<AbortController | null>(null);
  const backgroundAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeReadyChapterIdRef.current = currentReadyChapterId;
  }, [currentReadyChapterId]);

  useEffect(() => {
    return () => {
      blockingAbortRef.current?.abort();
      backgroundAbortRef.current?.abort();
    };
  }, []);

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
            !shouldApplyBackgroundResponse({
              activeReadyChapterId: activeReadyChapterIdRef.current,
              currentRequestId: backgroundRequestIdRef.current,
              requestId,
              requestWasAborted: controller.signal.aborted,
              targetChapterId: nextChapterId,
            })
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
            shouldFinalizeNavigationRequest({
              activeAbortController: backgroundAbortRef.current,
              currentRequestId: backgroundRequestIdRef.current,
              requestController: controller,
              requestId,
            })
          ) {
            backgroundAbortRef.current = null;
            setBackgroundChapterId((current) =>
              current === nextChapterId ? null : current,
            );
          }
        });
    },
    [getToken, isLoaded, isSignedIn, libraryItemId, mergeReadyPayload, setPayload],
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
          !shouldApplyBlockingResponse({
            currentRequestId: blockingRequestIdRef.current,
            requestId,
            requestWasAborted: controller.signal.aborted,
          })
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
          shouldFinalizeNavigationRequest({
            activeAbortController: blockingAbortRef.current,
            currentRequestId: blockingRequestIdRef.current,
            requestController: controller,
            requestId,
          })
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
      dispatchTraversal,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      mergeReadyPayload,
      setPayload,
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
