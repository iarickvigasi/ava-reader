import { describe, expect, it, vi } from "vitest";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import {
  PAGE_DIRECTION_BACKWARD,
  PAGE_DIRECTION_FORWARD,
  READER_MEASUREMENT_STATUS_PENDING,
  READER_RESTORE_PHASE_RESTORING,
  READER_RESTORE_PHASE_SETTLED,
  areLocatorsEqual,
  resolveMeasurementStatus,
  resolvePageResolutionForLocator,
  resolvePageStepOutcome,
  resolveReadyMeasurementEntry,
  resolveRestorePhase,
  resolveSwipeNavigationOutcome,
  resolveVisibleLocatorPublishDecision,
} from "./use-reader-pagination.helpers";

describe("useReaderPagination helpers", () => {
  describe("measurement and locator resolution", () => {
    it("resolves missing entries to pending status and no ready entry", () => {
      expect(resolveMeasurementStatus(null)).toBe(READER_MEASUREMENT_STATUS_PENDING);
      expect(resolveReadyMeasurementEntry(null)).toBeNull();
    });

    it("returns null page resolution when locator or measurement cannot resolve", () => {
      const resolvePageIndex = vi.fn(() => ({
        column: 2,
        pageIndex: 3,
        status: "exact",
      }) as const);
      const readyEntry = createReadyMeasurementEntry({
        resolvePageIndex,
      });

      expect(
        resolvePageResolutionForLocator({
          activeChapterId: "chapter-a",
          locator: null,
          measurementEntry: readyEntry,
        }),
      ).toBeNull();

      expect(
        resolvePageResolutionForLocator({
          activeChapterId: "chapter-a",
          locator: {
            blockId: "chapter-b::block-1",
            chapterId: "chapter-b",
            textOffset: 8,
          },
          measurementEntry: readyEntry,
        }),
      ).toBeNull();

      expect(resolvePageIndex).not.toHaveBeenCalled();
    });

    it("resolves locator page index for matching ready measurements", () => {
      const readyEntry = createReadyMeasurementEntry({
        resolvePageIndex: vi.fn(() => ({
          column: 2 as const,
          pageIndex: 7,
          status: "exact" as const,
        })),
      });

      expect(
        resolvePageResolutionForLocator({
          activeChapterId: "chapter-a",
          locator: {
            blockId: "chapter-a::block-2",
            chapterId: "chapter-a",
            textOffset: 14,
          },
          measurementEntry: readyEntry,
        }),
      ).toEqual({
        column: 2,
        pageIndex: 7,
        status: "exact",
      });
    });
  });

  describe("restore phase and locator publishing", () => {
    it("resolves restore phase from settled key and measurement status", () => {
      expect(
        resolveRestorePhase({
          activeMeasurementStatus: "ready",
          activeRestoreCycleKey: "restore:key",
          settledRestoreCycleKey: "restore:key",
        }),
      ).toBe(READER_RESTORE_PHASE_SETTLED);

      expect(
        resolveRestorePhase({
          activeMeasurementStatus: "pending",
          activeRestoreCycleKey: "restore:key",
          settledRestoreCycleKey: "restore:key",
        }),
      ).toBe(READER_RESTORE_PHASE_RESTORING);
    });

    it("publishes only when restore is settled and locator changed", () => {
      const readyEntry = createReadyMeasurementEntry({
        resolveLocator: vi.fn(() => ({
          blockId: "chapter-a::block-3",
          chapterId: "chapter-a",
          textOffset: 21,
        })),
      });

      expect(
        resolveVisibleLocatorPublishDecision({
          activeReadyMeasurementEntry: readyEntry,
          currentPageIndex: 2,
          isBootstrapping: true,
          prefixPageCount: 0,
          restorePhase: READER_RESTORE_PHASE_SETTLED,
          visibleLocator: null,
        }),
      ).toEqual({
        nextLocator: null,
        shouldPublishLocator: false,
      });

      expect(
        resolveVisibleLocatorPublishDecision({
          activeReadyMeasurementEntry: readyEntry,
          currentPageIndex: 2,
          isBootstrapping: false,
          prefixPageCount: 0,
          restorePhase: READER_RESTORE_PHASE_RESTORING,
          visibleLocator: null,
        }),
      ).toEqual({
        nextLocator: null,
        shouldPublishLocator: false,
      });

      expect(
        resolveVisibleLocatorPublishDecision({
          activeReadyMeasurementEntry: readyEntry,
          currentPageIndex: 2,
          isBootstrapping: false,
          prefixPageCount: 0,
          restorePhase: READER_RESTORE_PHASE_SETTLED,
          visibleLocator: {
            blockId: "chapter-a::block-3",
            chapterId: "chapter-a",
            textOffset: 21,
          },
        }),
      ).toEqual({
        nextLocator: null,
        shouldPublishLocator: false,
      });

      expect(
        resolveVisibleLocatorPublishDecision({
          activeReadyMeasurementEntry: readyEntry,
          currentPageIndex: 2,
          isBootstrapping: false,
          prefixPageCount: 0,
          restorePhase: READER_RESTORE_PHASE_SETTLED,
          visibleLocator: {
            blockId: "chapter-a::block-1",
            chapterId: "chapter-a",
            textOffset: 0,
          },
        }),
      ).toEqual({
        nextLocator: {
          blockId: "chapter-a::block-3",
          chapterId: "chapter-a",
          textOffset: 21,
        },
        shouldPublishLocator: true,
      });
    });

    it("compares locators safely", () => {
      expect(
        areLocatorsEqual(
          {
            blockId: "b1",
            chapterId: "c1",
            textOffset: 0,
          },
          {
            blockId: "b1",
            chapterId: "c1",
            textOffset: 0,
          },
        ),
      ).toBe(true);

      expect(
        areLocatorsEqual(
          {
            blockId: "b1",
            chapterId: "c1",
            textOffset: 0,
          },
          {
            blockId: "b2",
            chapterId: "c1",
            textOffset: 0,
          },
        ),
      ).toBe(false);
    });
  });

  describe("swipe and step outcomes", () => {
    it("classifies swipe outcomes by threshold and axis", () => {
      expect(
        resolveSwipeNavigationOutcome({
          deltaX: 12,
          deltaY: 2,
          swipeMaxOffAxis: 42,
          swipeThreshold: 30,
        }),
      ).toBe("none");

      expect(
        resolveSwipeNavigationOutcome({
          deltaX: 40,
          deltaY: 50,
          swipeMaxOffAxis: 42,
          swipeThreshold: 30,
        }),
      ).toBe("none");

      expect(
        resolveSwipeNavigationOutcome({
          deltaX: 40,
          deltaY: 41,
          swipeMaxOffAxis: 42,
          swipeThreshold: 30,
        }),
      ).toBe("none");

      expect(
        resolveSwipeNavigationOutcome({
          deltaX: -46,
          deltaY: 5,
          swipeMaxOffAxis: 42,
          swipeThreshold: 30,
        }),
      ).toBe("next-page");

      expect(
        resolveSwipeNavigationOutcome({
          deltaX: 46,
          deltaY: 5,
          swipeMaxOffAxis: 42,
          swipeThreshold: 30,
        }),
      ).toBe("previous-page");
    });

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
});

function createReadyMeasurementEntry(input?: {
  resolveLocator?: (pageIndex: number) => {
    blockId: string;
    chapterId: string;
    textOffset: number;
  } | null;
  resolvePageIndex?: () => {
    column: 1 | 2;
    pageIndex: number;
    status: "exact";
  };
}): Extract<ReaderMeasurementEntry, { status: "ready" }> {
  return {
    chapterId: "chapter-a",
    layoutKey: "layout:chapter-a",
    pageCount: 12,
    resolveLocator:
      input?.resolveLocator ??
      (() => ({
        blockId: "chapter-a::block-1",
        chapterId: "chapter-a",
        textOffset: 0,
      })),
    resolvePageIndex:
      input?.resolvePageIndex ??
      (() => ({
        column: 2,
        pageIndex: 0,
        status: "exact",
      })),
    status: "ready",
  };
}
