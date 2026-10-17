import { useCallback, useEffect, useRef } from "react";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { ReadyReaderPayload } from "../../../shared/types";
import type { ChapterNavigationInput } from "./chapter-navigation.types";
import { createRestoreIntentKey } from "./use-reader-chapter-navigation.helpers";

export function useChapterCommit(input: ChapterNavigationInput) {
  const sequence = useRef(0);
  const activeReadyChapterIdRef = useRef(input.currentReadyChapterId);
  useEffect(() => {
    activeReadyChapterIdRef.current = input.currentReadyChapterId;
  }, [input.currentReadyChapterId]);
  const { setVisibleLocator, dispatchTraversal, setPayload } = input;
  const commitVisibleChapter = useCallback(
    (chapterId: string, target: ReaderNavigationTarget) => {
      setVisibleLocator(null);
      activeReadyChapterIdRef.current = chapterId;
      dispatchTraversal({
        chapterId,
        target,
        type: "commit-chapter",
        key: createRestoreIntentKey({
          chapterId,
          target,
          sequence: ++sequence.current,
        }),
      });
    },
    [dispatchTraversal, setVisibleLocator],
  );
  const mergeReadyPayload = useCallback(
    (next: ReadyReaderPayload) => {
      setPayload((current) =>
        current.status === "READY"
          ? { ...next, progress: current.progress }
          : next,
      );
    },
    [setPayload],
  );
  return { commitVisibleChapter, mergeReadyPayload, activeReadyChapterIdRef };
}
