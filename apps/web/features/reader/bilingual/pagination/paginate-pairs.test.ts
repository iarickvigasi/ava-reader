import { describe, expect, it } from "vitest";
import { paginatePairs } from "./paginate-pairs";
import { sentence } from "./test-fixture";

describe("paired bilingual pagination", () => {
  it("reserves each row's taller side and paginates both sides together", () => {
    const result = paginatePairs({
      units: [
        sentence("a", 20, 40),
        sentence("b", 40, 20),
        sentence("c", 20, 30),
      ],
      paneHeight: 100,
      rowGap: 10,
    });
    expect(
      result.pages.map((page) => [page.unitIndexes, page.usedHeight]),
    ).toEqual([
      [[0, 1], 90],
      [[2], 30],
    ]);
    expect(result.pages.every((page) => page.isComplete)).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  it("keeps the last page provisional while requesting only its first unknown sentence", () => {
    const result = paginatePairs({
      units: [
        sentence("a", 40),
        sentence("b", 30, null),
        sentence("c", 30, null),
      ],
      paneHeight: 100,
      maxPages: 2,
    });
    expect(result.pages).toEqual([
      { unitIndexes: [0], startUnitId: "a", usedHeight: 40, isComplete: false },
    ]);
    expect(result.nextMissingUnitId).toBe("b");
    expect(result.nextMissingUnitIndex).toBe(1);
    expect(result.isComplete).toBe(false);
  });

  it("stops after two exact-fit pages without demanding the next sentence", () => {
    const result = paginatePairs({
      units: [sentence("a", 100), sentence("b", 100), sentence("c", 20, null)],
      paneHeight: 100,
      maxPages: 2,
    });
    expect(result.pages).toHaveLength(2);
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.nextUnitIndex).toBe(2);
    expect(result.isComplete).toBe(false);
  });

  it("uses source height to close the second page without translating its successor", () => {
    const result = paginatePairs({
      units: [sentence("a", 70), sentence("b", 70), sentence("c", 50, null)],
      paneHeight: 100,
      maxPages: 2,
    });
    expect(result.pages.map((page) => page.unitIndexes)).toEqual([[0], [1]]);
    expect(result.pages.every((page) => page.isComplete)).toBe(true);
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.nextUnitIndex).toBe(2);
  });

  it("needs at most one translated sentence of lookahead to discover an overflow", () => {
    const units = [
      sentence("a", 60),
      sentence("b", 60),
      sentence("c", 20, null),
      sentence("d", 20, null),
    ];
    const before = paginatePairs({ units, paneHeight: 100, maxPages: 2 });
    expect(before.nextMissingUnitId).toBe("c");
    expect(before.pages.map((page) => page.isComplete)).toEqual([true, false]);

    units[2] = sentence("c", 20, 60);
    const after = paginatePairs({ units, paneHeight: 100, maxPages: 2 });
    expect(after.pages.map((page) => page.unitIndexes)).toEqual([[0], [1]]);
    expect(after.nextMissingUnitId).toBeNull();
    expect(after.nextUnitIndex).toBe(2);
  });
});
