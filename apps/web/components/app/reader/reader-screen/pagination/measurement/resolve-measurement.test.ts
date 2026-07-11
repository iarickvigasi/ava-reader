import { describe, expect, it, vi } from "vitest";
import {
  READER_MEASUREMENT_STATUS_PENDING,
  resolveMeasurementStatus,
  resolvePageResolutionForLocator,
  resolveReadyMeasurementEntry,
} from "./resolve-measurement";
import { createReadyMeasurementEntry } from "./measurement-test-fixture";

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
