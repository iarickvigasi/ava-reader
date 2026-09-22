import { describe, expect, it, vi } from "vitest";

import {
  positionForBilingualPage,
  resolveBilingualPageIndex,
} from "./page-position";
import {
  anchorMeasurements,
  anchorPage,
  anchorPosition,
  anchorUnits,
} from "./position-test-fixture";

describe("bilingual visible page position", () => {
  it("keeps backwards chapter entry on the final continuation as translation arrives", () => {
    const position = { ...anchorPosition, unitIndex: 2, edge: "end" as const };
    const first = [anchorPage([0, 1]), anchorPage([2], 0)];
    const translated = [...first, anchorPage([2], 1), anchorPage([2], 2)];
    expect(
      resolveBilingualPageIndex({
        pages: first,
        units: anchorUnits,
        position,
        layoutKey: "size",
      }),
    ).toBe(1);
    expect(
      resolveBilingualPageIndex({
        pages: translated,
        units: anchorUnits,
        position,
        layoutKey: "size",
      }),
    ).toBe(3);
  });

  it("uses the original text offset to resolve a continuation after resizing", () => {
    const resolveContinuation = vi.fn().mockReturnValue(2);
    const pages = [
      anchorPage([0]),
      anchorPage([1], 0),
      anchorPage([1], 1),
      anchorPage([1], 2),
    ];
    expect(
      resolveBilingualPageIndex({
        pages,
        units: anchorUnits,
        position: anchorPosition,
        layoutKey: "new-size",
        resolveContinuation,
      }),
    ).toBe(3);
    expect(resolveContinuation).toHaveBeenCalledWith(1, 125);
  });

  it("remembers the actual first visible sentence, preventing drift after a middle-of-page restore", () => {
    const page = anchorPage([0, 1]);
    const saved = positionForBilingualPage({
      previous: anchorPosition,
      page,
      units: anchorUnits,
      measured: anchorMeasurements,
      layoutKey: "new-size",
      offset: 7,
      keepEdge: true,
    });
    expect(saved).toMatchObject({
      unitIndex: 0,
      offset: 7,
      continuation: 0,
      layoutKey: "new-size",
    });
    const again = positionForBilingualPage({
      previous: saved,
      page,
      units: anchorUnits,
      measured: anchorMeasurements,
      layoutKey: "new-size",
      offset: 7,
      keepEdge: true,
    });
    expect(again).toBe(saved);
  });

  it("stores the end of the source when continuing through a longer translation", () => {
    const saved = positionForBilingualPage({
      previous: anchorPosition,
      page: anchorPage([1], 3),
      units: anchorUnits,
      measured: anchorMeasurements,
      layoutKey: "new-size",
      offset: 100,
    });
    expect(saved).toMatchObject({ unitIndex: 1, offset: 200, continuation: 3 });
    const pages = [anchorPage([0]), anchorPage([1], 0), anchorPage([1], 1)];
    const resolveContinuation = vi.fn().mockReturnValue(0);
    expect(
      resolveBilingualPageIndex({
        pages,
        units: anchorUnits,
        position: saved,
        layoutKey: "smaller-font",
        resolveContinuation,
      }),
    ).toBe(2);
    expect(resolveContinuation).not.toHaveBeenCalled();
  });

  it("releases the chapter edge on paging and preserves it during progress publication", () => {
    const previous = { ...anchorPosition, edge: "end" as const };
    const input = {
      previous,
      page: anchorPage([1]),
      units: anchorUnits,
      measured: anchorMeasurements,
      layoutKey: "size",
    };
    expect(positionForBilingualPage({ ...input, keepEdge: true }).edge).toBe(
      "end",
    );
    expect(positionForBilingualPage(input).edge).toBeNull();
  });
});
