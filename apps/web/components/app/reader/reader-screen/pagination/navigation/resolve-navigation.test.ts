import { describe, expect, it } from "vitest";
import {
  PAGE_DIRECTION_BACKWARD,
  PAGE_DIRECTION_FORWARD,
  resolvePageStepOutcome,
  resolveSwipeNavigationOutcome,
} from "./resolve-navigation";

describe("resolveSwipeNavigationOutcome", () => {
  it("classifies swipe outcomes by threshold and axis", () => {
    expect(
      resolveSwipeNavigationOutcome({
        deltaX: 12,
        deltaY: 2,
        hasActiveSelection: false,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("none");

    expect(
      resolveSwipeNavigationOutcome({
        deltaX: 40,
        deltaY: 50,
        hasActiveSelection: false,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("none");

    expect(
      resolveSwipeNavigationOutcome({
        deltaX: 40,
        deltaY: 41,
        hasActiveSelection: false,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("none");

    expect(
      resolveSwipeNavigationOutcome({
        deltaX: -46,
        deltaY: 5,
        hasActiveSelection: false,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("next-page");

    expect(
      resolveSwipeNavigationOutcome({
        deltaX: 46,
        deltaY: 5,
        hasActiveSelection: false,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("previous-page");
  });

  it("suppresses swipe navigation while a text selection is active", () => {
    // A selection drag on mobile easily clears the swipe threshold. Without
    // this guard it would be classified as a page swipe (previous/next),
    // turning the page out from under the reader's selection.
    expect(
      resolveSwipeNavigationOutcome({
        deltaX: -80,
        deltaY: 5,
        hasActiveSelection: true,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("none");

    expect(
      resolveSwipeNavigationOutcome({
        deltaX: 80,
        deltaY: 5,
        hasActiveSelection: true,
        swipeMaxOffAxis: 42,
        swipeThreshold: 30,
      }),
    ).toBe("none");
  });
});

describe("resolvePageStepOutcome", () => {
  it("resolves page-step outcomes for loading, neighbor pages, and chapter boundaries", () => {
    expect(
      resolvePageStepOutcome({
        currentPageIndex: 3,
        direction: PAGE_DIRECTION_FORWARD,
        isLoadingChapter: true,
        nextChapterId: "chapter-b",
        pageCount: 12,
        previousChapterId: "chapter-a",
      }),
    ).toEqual({ kind: "noop-loading" });

    expect(
      resolvePageStepOutcome({
        currentPageIndex: 3,
        direction: PAGE_DIRECTION_FORWARD,
        isLoadingChapter: false,
        nextChapterId: "chapter-b",
        pageCount: 12,
        previousChapterId: "chapter-a",
      }),
    ).toEqual({ kind: "step-page" });

    expect(
      resolvePageStepOutcome({
        currentPageIndex: 11,
        direction: PAGE_DIRECTION_FORWARD,
        isLoadingChapter: false,
        nextChapterId: "chapter-b",
        pageCount: 12,
        previousChapterId: "chapter-a",
      }),
    ).toEqual({
      edge: "start",
      kind: "select-chapter",
      nextChapterId: "chapter-b",
    });

    expect(
      resolvePageStepOutcome({
        currentPageIndex: 0,
        direction: PAGE_DIRECTION_BACKWARD,
        isLoadingChapter: false,
        nextChapterId: "chapter-b",
        pageCount: 12,
        previousChapterId: "chapter-a",
      }),
    ).toEqual({
      edge: "end",
      kind: "select-chapter",
      nextChapterId: "chapter-a",
    });

    expect(
      resolvePageStepOutcome({
        currentPageIndex: 0,
        direction: PAGE_DIRECTION_BACKWARD,
        isLoadingChapter: false,
        nextChapterId: null,
        pageCount: 12,
        previousChapterId: null,
      }),
    ).toEqual({ kind: "noop-boundary" });
  });
});
