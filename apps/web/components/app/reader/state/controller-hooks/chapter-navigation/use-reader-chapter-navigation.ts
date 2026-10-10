import { useCallback } from "react";
import { canonicalPayload } from "@/features/reader/canonical/payload";
import { resolveJumpTarget } from "@/features/reader/jump-target";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { shouldRefreshChapterWindow } from "../../../shared/utils";
import { useBackgroundChapterRefresh } from "./use-background-chapter-refresh";
import { useBlockingChapterLoad } from "./use-blocking-chapter-load";
import { useChapterCommit } from "./use-chapter-commit";
import type { ChapterNavigationInput } from "./chapter-navigation.types";

export function useReaderChapterNavigation(input: ChapterNavigationInput) {
  const { readyPayload, loadedChaptersById } = input;
  const commit = useChapterCommit(input);
  const { commitVisibleChapter, mergeReadyPayload } = commit;
  const background = useBackgroundChapterRefresh({ ...input, ...commit });
  const { cancelBackgroundRefresh, refreshChapterWindow, backgroundChapterId } =
    background;
  const { loadChapterWindow, cancelBlockingLoad } = useBlockingChapterLoad({
    ...input,
    ...commit,
    cancelBackgroundRefresh,
  });
  const navigateToChapter = useCallback(
    async (chapterId: string, target?: ReaderNavigationTarget) => {
      if (readyPayload?.readerPackage) {
        const next = canonicalPayload({
          ...readyPayload,
          activeChapterId: chapterId,
        });
        if (next.status !== "READY")
          throw new Error("The requested chapter is unavailable.");
        const chapter = next.chapters.find(
          (item) => item.chapterId === chapterId,
        );
        if (!chapter || !resolveJumpTarget(chapter, target))
          throw new Error("The requested passage is unavailable.");
        cancelBlockingLoad();
        cancelBackgroundRefresh();
        mergeReadyPayload(next);
        commitVisibleChapter(chapterId, target);
        return;
      }
      const loaded = loadedChaptersById.get(chapterId);
      if (loaded) {
        if (!resolveJumpTarget(loaded, target))
          throw new Error("The requested passage is unavailable.");
        cancelBlockingLoad();
        commitVisibleChapter(chapterId, target);
        if (readyPayload && shouldRefreshChapterWindow(readyPayload, chapterId))
          refreshChapterWindow(chapterId);
        return;
      }
      await loadChapterWindow(chapterId, target);
    },
    [
      readyPayload,
      loadedChaptersById,
      cancelBlockingLoad,
      cancelBackgroundRefresh,
      mergeReadyPayload,
      commitVisibleChapter,
      refreshChapterWindow,
      loadChapterWindow,
    ],
  );
  return {
    backgroundChapterId,
    cancelBlockingLoad,
    commitVisibleChapter,
    loadChapterWindow,
    navigateToChapter,
  };
}
