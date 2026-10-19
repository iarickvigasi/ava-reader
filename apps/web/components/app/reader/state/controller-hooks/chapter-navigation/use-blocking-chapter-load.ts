import { useCallback } from "react";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { ReadyReaderPayload } from "../../../shared/types";
import { isAbortError } from "../../../shared/utils";
import type { ChapterNavigationInput } from "./chapter-navigation.types";
import { loadRequestedChapter } from "./load-requested-chapter";
import { useChapterRequest } from "./use-chapter-request";

type Input = Pick<
  ChapterNavigationInput,
  "getToken" | "isLoaded" | "isSignedIn" | "libraryItemId" | "dispatchTraversal"
> & {
  cancelBackgroundRefresh: () => void;
  commitVisibleChapter: (
    chapterId: string,
    target: ReaderNavigationTarget,
  ) => void;
  mergeReadyPayload: (payload: ReadyReaderPayload) => void;
};
export function useBlockingChapterLoad(input: Input) {
  const { start, cancel } = useChapterRequest();
  const {
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    dispatchTraversal,
    cancelBackgroundRefresh,
    mergeReadyPayload,
    commitVisibleChapter,
  } = input;
  const loadChapterWindow = useCallback(
    async (chapterId: string, target: ReaderNavigationTarget) => {
      const request = start();
      cancelBackgroundRefresh();
      dispatchTraversal({ chapterId, type: "start-pending" });
      try {
        const next = await loadRequestedChapter(
          {
            getToken,
            isLoaded,
            isSignedIn,
            libraryItemId,
            chapterId,
            signal: request.signal,
          },
          target,
        );
        if (!request.current()) return;
        mergeReadyPayload(next);
        commitVisibleChapter(chapterId, target);
      } catch (error) {
        if (!isAbortError(error)) throw error;
      } finally {
        if (request.current())
          dispatchTraversal({ chapterId, type: "clear-pending" });
      }
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      dispatchTraversal,
      cancelBackgroundRefresh,
      mergeReadyPayload,
      commitVisibleChapter,
      start,
    ],
  );
  return { loadChapterWindow, cancelBlockingLoad: cancel };
}
