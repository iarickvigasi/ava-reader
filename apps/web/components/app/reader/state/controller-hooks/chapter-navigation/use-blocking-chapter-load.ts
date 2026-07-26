import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  ReaderTraversalAction,
} from "@/features/reader/navigation";
import { fetchReaderPayload } from "../../../data/reader-client";
import type { ReaderControllerAuth, ReadyReaderPayload } from "../../../shared/types";
import {
  isAbortError,
  isReadyReaderPayload,
  normalizeReaderStatusPayload,
} from "../../../shared/utils";
import {
  shouldApplyBlockingResponse,
  shouldFinalizeNavigationRequest,
} from "./use-reader-chapter-navigation.helpers";

type UseBlockingChapterLoadInput = ReaderControllerAuth & {
  cancelBackgroundRefresh: () => void;
  commitVisibleChapter: (
    nextChapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  dispatchTraversal: Dispatch<ReaderTraversalAction>;
  libraryItemId: string;
  mergeReadyPayload: (nextPayload: ReadyReaderPayload) => void;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
};

/**
 * Fetches a chapter the reader doesn't have loaded yet, blocking navigation
 * (shows a loading state) until it arrives.
 */
export function useBlockingChapterLoad({
  cancelBackgroundRefresh,
  commitVisibleChapter,
  dispatchTraversal,
  getToken,
  isLoaded,
  isSignedIn,
  libraryItemId,
  mergeReadyPayload,
  setPayload,
}: UseBlockingChapterLoadInput) {
  const blockingRequestIdRef = useRef(0);
  const blockingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      blockingAbortRef.current?.abort();
    };
  }, []);

  const loadChapterWindow = useCallback(
    async (nextChapterId: string, target: ReaderNavigationTarget) => {
      const requestId = blockingRequestIdRef.current + 1;
      blockingRequestIdRef.current = requestId;
      blockingAbortRef.current?.abort();
      cancelBackgroundRefresh();

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
      cancelBackgroundRefresh,
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

  return { loadChapterWindow };
}
