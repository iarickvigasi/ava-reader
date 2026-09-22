import { describe, expect, it } from "vitest";
import { paginatePairs } from "./paginate-pairs";
import { sentence } from "./test-fixture";

describe("bilingual continuation pagination", () => {
  it("expands a long translation into continuation pages without losing either side", () => {
    const result = paginatePairs({
      units: [
        sentence("a", 40),
        sentence("b", 150, 350, {
          sourcePageCount: 2,
          translationPageCount: 4,
        }),
        sentence("c", 20),
      ],
      paneHeight: 100,
    });
    expect(
      result.pages.map((page) => [page.unitIndexes, page.continuationIndex]),
    ).toEqual([
      [[0], undefined],
      [[1], 0],
      [[1], 1],
      [[1], 2],
      [[1], 3],
      [[2], undefined],
    ]);
    expect(result.pages.every((page) => page.usedHeight <= 100)).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  it("stops demand inside a long sentence after its second continuation page", () => {
    const units = [
      sentence("a", 40, 450, { sourcePageCount: 1, translationPageCount: 5 }),
      sentence("b", 20, null),
    ];
    const result = paginatePairs({ units, paneHeight: 100, maxPages: 2 });
    expect(result.pages.map((page) => page.continuationIndex)).toEqual([0, 1]);
    expect(result.nextUnitIndex).toBe(0);
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.isComplete).toBe(false);

    const advanced = paginatePairs({ units, paneHeight: 100, maxPages: 5 });
    expect(advanced.pages.map((page) => page.continuationIndex)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(advanced.nextMissingUnitId).toBeNull();
    expect(advanced.nextUnitIndex).toBe(1);
  });

  it("requests actual column measurement for oversized text instead of guessing", () => {
    const result = paginatePairs({
      units: [sentence("a", 40, 220), sentence("b", 20, null)],
      paneHeight: 100,
    });
    expect(result.pages).toEqual([]);
    expect(result.nextMeasurementUnitId).toBe("a");
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.nextUnitIndex).toBe(0);
  });

  it("rejects stale one-column measurement that would overflow a pane", () => {
    const result = paginatePairs({
      units: [sentence("a", 120, 40, { sourcePageCount: 1 })],
      paneHeight: 100,
    });
    expect(result.nextMeasurementUnitId).toBe("a");
    expect(result.pages).toEqual([]);
  });
});
