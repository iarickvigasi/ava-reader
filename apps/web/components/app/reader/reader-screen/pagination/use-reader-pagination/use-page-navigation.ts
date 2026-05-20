import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import {
  READER_NAVIGATION_EDGE_END,
  READER_NAVIGATION_EDGE_START,
  SWIPE_MAX_OFF_AXIS,
  SWIPE_THRESHOLD,
} from "../../shared/constants";
import { clamp, isInteractiveTarget } from "../../shared/utils";
import {
  PAGE_DIRECTION_BACKWARD,
  PAGE_DIRECTION_FORWARD,
  resolvePageStepOutcome,
  resolveSwipeNavigationOutcome,
} from "../use-reader-pagination.helpers";
import type { PaginationPageDirection } from "../use-reader-pagination.helpers";

const KEY_ARROW_LEFT = "ArrowLeft";
const KEY_ARROW_RIGHT = "ArrowRight";

/**
 *  Exposes two event handlers (handleTouchStart, handleTouchEnd)
 *  and manages a window keydown listener internally.
 */
export function usePageNavigation({
  currentPageIndex,
  setCurrentPageIndex,
  pageCount,
  isLoadingChapter,
  isPanelOpen,
  activeChapter,
  onSelectChapter,
}: {
  currentPageIndex: number;
  setCurrentPageIndex: (update: number | ((prev: number) => number)) => void;
  pageCount: number;
  isLoadingChapter: boolean;
  isPanelOpen: boolean;
  activeChapter: ReaderChapterPayload;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * 1. stepPage(direction) — the single decision maker
   *  - Calls resolvePageStepOutcome
   *  - If outcome is step-page: bumps currentPageIndex via clamp(current + direction, 0, pageCount - 1)
   *  - If outcome is select-chapter: calls onSelectChapter(nextChapterId, { edge: "start" | "end" })
   *  - Does nothing when isLoadingChapter or at absolute boundary with no neighbor chapter
   */
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

  /**
   *   2. Keyboard navigation
   *    - Attaches a window keydown listener in a useEffect
   *    - ArrowRight → goToNextPage()
   *    - ArrowLeft → goToPreviousPage()
   *    - Ignores keypresses when a panel is open or the focus is inside an interactive target (input, button, etc.)
   */
  const goToNextPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_FORWARD);
  }, [stepPage]);

  const goToPreviousPage = useCallback(() => {
    stepPage(PAGE_DIRECTION_BACKWARD);
  }, [stepPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPanelOpen || isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === KEY_ARROW_RIGHT) {
        event.preventDefault();
        goToNextPage();
      }

      if (event.key === KEY_ARROW_LEFT) {
        event.preventDefault();
        goToPreviousPage();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToNextPage, goToPreviousPage, isPanelOpen]);

  /**
   * 3. Touch swipe navigation
   *  - handleTouchStart: stores the first touch coordinates in a ref (or nulls it out if loading/panel-open)
   *  - handleTouchEnd: computes deltaX and deltaY from the stored start point
   *  - Calls resolveSwipeNavigationOutcome which checks:
   *     -- Is |deltaX| above the swipe threshold?
   *     -- Is |deltaY| small enough (mostly horizontal)?
   *     -- Is |deltaY| < |deltaX|?
   *   - If the swipe is clearly left → goToNextPage()
   *   - If clearly right → goToPreviousPage()
   */
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];

    if (!touch || isLoadingChapter || isPanelOpen) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || isLoadingChapter || isPanelOpen) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const swipeOutcome = resolveSwipeNavigationOutcome({
      deltaX,
      deltaY,
      swipeMaxOffAxis: SWIPE_MAX_OFF_AXIS,
      swipeThreshold: SWIPE_THRESHOLD,
    });

    if (swipeOutcome === "next-page") {
      goToNextPage();
      return;
    }

    if (swipeOutcome === "previous-page") {
      goToPreviousPage();
    }
  };

  return {
    handleTouchEnd,
    handleTouchStart,
  };
}
