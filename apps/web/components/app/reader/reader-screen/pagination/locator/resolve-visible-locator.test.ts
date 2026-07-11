import { describe, expect, it, vi } from "vitest";
import {
  READER_RESTORE_PHASE_RESTORING,
  READER_RESTORE_PHASE_SETTLED,
} from "../restore/restore-phase";
import {
  areLocatorsEqual,
  resolveVisibleLocatorPublishDecision,
} from "./resolve-visible-locator";
import { createReadyMeasurementEntry } from "../measurement/measurement-test-fixture";

describe("visible locator publishing", () => {
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
