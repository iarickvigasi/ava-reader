import type { RefObject, TouchEvent as ReactTouchEvent } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import { type PageStepControls, usePageStepper } from "./use-page-stepper";
import { useKeyboardPageNavigation } from "./use-keyboard-page-navigation";
import { useSwipePageNavigation } from "./use-swipe-page-navigation";

// Composes reader page navigation across input modalities: a shared page
// stepper feeds buttons, keyboard arrows, and touch swipes.
export function usePageNavigation({
  currentPageIndex,
  setCurrentPageIndex,
  pageCount,
  isLoadingChapter,
  isPanelOpen,
  activeChapter,
  onSelectChapter,
  containerRef,
}: {
  currentPageIndex: number;
  setCurrentPageIndex: (update: number | ((prev: number) => number)) => void;
  pageCount: number;
  isLoadingChapter: boolean;
  isPanelOpen: boolean;
  activeChapter: ReaderChapterPayload;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
  // The reader's selectable content box. A touch that leaves a text selection
  // inside it is a selection gesture, not a swipe — so navigation is skipped.
  containerRef: RefObject<HTMLElement | null>;
}): PageStepControls & {
  handleTouchEnd: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
} {
  const { goToNextPage, goToPreviousPage } = usePageStepper({
    currentPageIndex,
    setCurrentPageIndex,
    pageCount,
    isLoadingChapter,
    activeChapter,
    onSelectChapter,
  });

  useKeyboardPageNavigation({
    goToNextPage,
    goToPreviousPage,
    isPanelOpen,
  });

  const touchHandlers = useSwipePageNavigation({
    goToNextPage,
    goToPreviousPage,
    isLoadingChapter,
    isPanelOpen,
    containerRef,
  });

  return { ...touchHandlers, goToNextPage, goToPreviousPage };
}
