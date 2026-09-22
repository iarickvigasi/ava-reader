import { describe, expect, it, vi } from "vitest";

import { paginatePairs } from "./paginate-pairs";
import { sentence } from "./test-fixture";

describe("natural paragraph pagination", () => {
  it("fits sentence prefixes using continuous paragraph height, not isolated sentence rows", () => {
    const units = [sentence("a", 45), sentence("b", 45), sentence("c", 45)];
    const measureRange = (start: number, end: number) => ({
      sourceHeight: 20 + (end - start) * 20,
      translationHeight: 20 + (end - start) * 20,
    });
    const result = paginatePairs({ units, paneHeight: 100, measureRange });
    expect(result.pages.map((page) => page.unitIndexes)).toEqual([[0, 1, 2]]);
    expect(result.pages[0].usedHeight).toBe(80);
  });

  it("lets each side flow independently and breaks where the longer page ends", () => {
    const units = [sentence("a", 25), sentence("b", 25), sentence("c", 25)];
    const result = paginatePairs({
      units,
      paneHeight: 100,
      measureRange: (start, end) => ({
        sourceHeight: (end - start) * 20,
        translationHeight: (end - start) * 45,
      }),
    });
    expect(result.pages.map((page) => page.unitIndexes)).toEqual([[0, 1], [2]]);
    expect(result.pages.map((page) => page.usedHeight)).toEqual([90, 45]);
  });

  it("remeasures from each new page start instead of subtracting chapter-relative heights", () => {
    const units = Array.from({ length: 5 }, (_, index) =>
      sentence(String(index), 25),
    );
    const measureRange = vi.fn((start: number, end: number) => ({
      sourceHeight: (end - start) * (start === 0 ? 40 : 30),
      translationHeight: (end - start) * (start === 0 ? 40 : 30),
    }));
    const result = paginatePairs({ units, paneHeight: 100, measureRange });
    expect(result.pages.map((page) => page.unitIndexes)).toEqual([
      [0, 1],
      [2, 3, 4],
    ]);
    expect(measureRange).toHaveBeenCalledWith(2, 5);
  });

  it("stops current/next demand before requesting an unknown sentence proven to overflow", () => {
    const units = [
      sentence("a", 60),
      sentence("b", 60),
      sentence("c", 60, null),
    ];
    const result = paginatePairs({
      units,
      paneHeight: 100,
      maxPages: 2,
      measureRange: (start, end) => ({
        sourceHeight: (end - start) * 60,
        translationHeight: end > 2 ? null : (end - start) * 60,
      }),
    });
    expect(result.pages.map((page) => page.unitIndexes)).toEqual([[0], [1]]);
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.nextUnitIndex).toBe(2);
  });

  it("requests only the first missing sentence needed to complete a flowing page", () => {
    const units = [
      sentence("a", 20),
      sentence("b", 20, null),
      sentence("c", 20, null),
    ];
    const result = paginatePairs({
      units,
      paneHeight: 100,
      maxPages: 2,
      measureRange: (start, end) => ({
        sourceHeight: (end - start) * 20,
        translationHeight: end > 1 ? null : 20,
      }),
    });
    expect(result.nextMissingUnitId).toBe("b");
    expect(result.pages[0].unitIndexes).toEqual([0]);
    expect(result.pages[0].isComplete).toBe(false);
  });

  it("continues an oversized individual sentence without spilling or padding other sentences", () => {
    const units = [
      sentence("a", 220, 40, { sourcePageCount: 3 }),
      sentence("b", 20),
    ];
    const result = paginatePairs({
      units,
      paneHeight: 100,
      measureRange: (start, end) => ({
        sourceHeight: start === 0 ? 220 : 20,
        translationHeight: (end - start) * 20,
      }),
    });
    expect(result.pages.map((page) => page.continuationIndex)).toEqual([
      0,
      1,
      2,
      undefined,
    ]);
    expect(result.pages.at(-1)?.unitIndexes).toEqual([1]);
  });
});
