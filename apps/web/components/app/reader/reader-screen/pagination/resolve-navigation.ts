export const PAGE_DIRECTION_FORWARD = 1;
export const PAGE_DIRECTION_BACKWARD = -1;

export type PaginationPageDirection =
  | typeof PAGE_DIRECTION_BACKWARD
  | typeof PAGE_DIRECTION_FORWARD;

export type SwipeNavigationOutcome =
  | "next-page"
  | "none"
  | "previous-page";

export type PageStepOutcome =
  | {
      kind: "noop-boundary";
    }
  | {
      kind: "noop-loading";
    }
  | {
      edge: "end" | "start";
      kind: "select-chapter";
      nextChapterId: string;
    }
  | {
      kind: "step-page";
    };

export function resolveSwipeNavigationOutcome(input: {
  deltaX: number;
  deltaY: number;
  // True when a non-empty text selection is active inside the reader. A
  // selection drag on touch clears the swipe threshold trivially, so without
  // this guard the gesture would be read as a page turn — turning the page out
  // from under the reader's selection. Selecting and swiping are mutually
  // exclusive on touch (see spec 1.6-selection-bridge).
  hasActiveSelection: boolean;
  swipeMaxOffAxis: number;
  swipeThreshold: number;
}): SwipeNavigationOutcome {
  if (input.hasActiveSelection) {
    return "none";
  }

  if (
    Math.abs(input.deltaX) < input.swipeThreshold ||
    Math.abs(input.deltaY) > input.swipeMaxOffAxis ||
    Math.abs(input.deltaY) > Math.abs(input.deltaX)
  ) {
    return "none";
  }

  return input.deltaX < 0 ? "next-page" : "previous-page";
}

export function resolvePageStepOutcome(input: {
  currentPageIndex: number;
  direction: PaginationPageDirection;
  isLoadingChapter: boolean;
  nextChapterId: string | null;
  pageCount: number;
  previousChapterId: string | null;
}): PageStepOutcome {
  if (input.isLoadingChapter) {
    return { kind: "noop-loading" };
  }

  const hasPreviousPage = input.currentPageIndex > 0;
  const hasNextPage = input.currentPageIndex < input.pageCount - 1;
  const isForward = input.direction === PAGE_DIRECTION_FORWARD;
  const hasNeighborPage = isForward ? hasNextPage : hasPreviousPage;

  if (hasNeighborPage) {
    return {
      kind: "step-page",
    };
  }

  const nextChapterId = isForward ? input.nextChapterId : input.previousChapterId;
  if (!nextChapterId) {
    return { kind: "noop-boundary" };
  }

  return {
    edge: isForward ? "start" : "end",
    kind: "select-chapter",
    nextChapterId,
  };
}
