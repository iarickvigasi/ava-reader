import { useRef } from "react";
import type { RefObject, TouchEvent as ReactTouchEvent } from "react";
import { SWIPE_MAX_OFF_AXIS, SWIPE_THRESHOLD } from "../../shared/constants";
import { hasActiveSelectionWithin } from "../../shared/utils";
import { resolveSwipeNavigationOutcome } from "../resolve-navigation";
import type { PageStepControls } from "./use-page-stepper";

// Touch swipe page turning. handleTouchStart records the first touch point (or
// disarms while loading / a panel is open); handleTouchEnd classifies the
// release delta via resolveSwipeNavigationOutcome. A drag that left a text
// selection inside containerRef is treated as a selection, not a swipe, so it
// never turns the page (see spec 1.6-selection-bridge).
export function useSwipePageNavigation({
  goToNextPage,
  goToPreviousPage,
  isLoadingChapter,
  isPanelOpen,
  containerRef,
}: PageStepControls & {
  isLoadingChapter: boolean;
  isPanelOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
      // Read synchronously here: the selection is still live at touchend (the
      // selection listener only clears it on a later tick), so a drag that
      // produced a selection is recognised and never turns the page.
      hasActiveSelection: hasActiveSelectionWithin(containerRef.current),
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

  return { handleTouchEnd, handleTouchStart };
}
