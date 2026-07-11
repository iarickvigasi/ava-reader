import { useCallback } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import {
  READER_NAVIGATION_EDGE_END,
  READER_NAVIGATION_EDGE_START,
} from "../../shared/constants";
import { clamp } from "../../shared/utils";
import {
  PAGE_DIRECTION_BACKWARD,
  PAGE_DIRECTION_FORWARD,
  resolvePageStepOutcome,
} from "./resolve-navigation";
import type { PaginationPageDirection } from "./resolve-navigation";

export type PageStepControls = {
  goToNextPage: () => void;
  goToPreviousPage: () => void;
};

// The single page-turn decision maker, shared by the keyboard and swipe
// drivers. stepPage(direction) asks resolvePageStepOutcome whether to move
// within the chapter (bump currentPageIndex) or cross into a neighbouring
// chapter (onSelectChapter with the landing edge); it no-ops while loading or
// at an absolute boundary with no neighbour.
export function usePageStepper({
  currentPageIndex,
  setCurrentPageIndex,
  pageCount,
  isLoadingChapter,
  activeChapter,
  onSelectChapter,
}: {
  currentPageIndex: number;
  setCurrentPageIndex: (update: number | ((prev: number) => number)) => void;
  pageCount: number;
  isLoadingChapter: boolean;
  activeChapter: ReaderChapterPayload;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
}): PageStepControls {
  const stepPage = useCallback(
    (direction: PaginationPageDirection) => {
      const pageStepOutcome = resolvePageStepOutcome({
        currentPageIndex,
        direction,
        isLoadingChapter,
        nextChapterId: activeChapter.nextChapterId,
        pageCount,
        previousChapterId: activeChapter.previousChapterId,
      });

      if (pageStepOutcome.kind === "step-page") {
        setCurrentPageIndex((current) =>
          clamp(current + direction, 0, pageCount - 1),
        );
        return;
      }

      if (pageStepOutcome.kind === "select-chapter") {
        onSelectChapter(pageStepOutcome.nextChapterId, {
          edge:
            pageStepOutcome.edge === "start"
              ? READER_NAVIGATION_EDGE_START
              : READER_NAVIGATION_EDGE_END,
        });
      }
    },
    [
      activeChapter.nextChapterId,
      activeChapter.previousChapterId,
      currentPageIndex,
      isLoadingChapter,
      onSelectChapter,
      pageCount,
      setCurrentPageIndex,
    ],
  );

  const goToNextPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_FORWARD);
  }, [stepPage]);

  const goToPreviousPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_BACKWARD);
  }, [stepPage]);

  return { goToNextPage, goToPreviousPage };
}
