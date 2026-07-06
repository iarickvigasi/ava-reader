import { describe, expect, it } from "vitest";
import type { ReaderLocator } from "@/lib/api-types";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import { createRestoreIntent } from "@/features/reader/navigation";
import { resolveRestoreStep } from "./resolve-restore-step";

function createReadyEntry(
  chapterId: string,
  pageCount: number,
  resolvePageIndex: ReadyEntry["resolvePageIndex"],
): ReaderMeasurementEntry {
  return {
    chapterId,
    layoutKey: `layout:${chapterId}`,
    pageCount,
    resolveLocator: () => null,
    resolvePageIndex,
    status: "ready",
  };
}

type ReadyEntry = Extract<ReaderMeasurementEntry, { status: "ready" }>;

describe("resolveRestoreStep", () => {
  it("keeps the reader on their page after they page away from a sticky edge", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );
    const visibleLocator: ReaderLocator = {
      blockId: "block-9",
      chapterId: "chapter-a",
      textOffset: 0,
    };

    const step = resolveRestoreStep({
      activeChapterId: "chapter-a",
      consumedRestoreIntentKey: restoreIntent.key,
      currentPageIndex: 3,
      isStickyRestorePinned: true,
      lastAppliedRestorePageIndex: 0,
      measurementEntry: createReadyEntry("chapter-a", 10, () => ({
        column: 1,
        pageIndex: 3,
        status: "exact",
      })),
      pageCount: 10,
      prefixPageCount: 0,
      restoreIntent,
      visibleLocator,
    });

    expect(step.decision.nextPageIndex).toBe(3);
    expect(step.keepRestorePinned).toBe(false);
  });

  it("pins a fresh sticky edge-start intent to the first page and keeps it pinned", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );

    const step = resolveRestoreStep({
      activeChapterId: "chapter-a",
      consumedRestoreIntentKey: null,
      currentPageIndex: 0,
      isStickyRestorePinned: true,
      lastAppliedRestorePageIndex: null,
      measurementEntry: createReadyEntry("chapter-a", 10, () => ({
        column: 1,
        pageIndex: 0,
        status: "exact",
      })),
      pageCount: 10,
      prefixPageCount: 0,
      restoreIntent,
      visibleLocator: null,
    });

    expect(step.decision.nextPageIndex).toBe(0);
    expect(step.decision.shouldConsumeRestoreIntent).toBe(true);
    expect(step.keepRestorePinned).toBe(true);
  });
});
