import { describe, expect, it } from "vitest";
import { paginatePairs } from "./paginate-pairs";
import { sentence } from "./test-fixture";

describe("bilingual image and range pagination", () => {
  it("contains images on one page and does not request an image translation", () => {
    const result = paginatePairs({
      units: [
        {
          id: "image",
          kind: "image",
          sourceHeight: 150,
          translationHeight: null,
        },
        sentence("a", 20),
      ],
      paneHeight: 100,
    });
    expect(
      result.pages.map((page) => [page.unitIndexes, page.usedHeight]),
    ).toEqual([
      [[0], 100],
      [[1], 20],
    ]);
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.isComplete).toBe(true);
  });

  it("opens a cached range without requesting missing sentences before the anchor", () => {
    const result = paginatePairs({
      units: [sentence("a", 20, null), sentence("b", 20), sentence("c", 20)],
      paneHeight: 100,
      startUnitIndex: 1,
    });
    expect(result.pages[0].unitIndexes).toEqual([1, 2]);
    expect(result.pages[0].startUnitId).toBe("b");
    expect(result.nextMissingUnitId).toBeNull();
    expect(result.isComplete).toBe(true);
  });

  it("handles tiny panes and zero-height rows without looping or clipping", () => {
    const result = paginatePairs({
      units: [
        sentence("a", 0),
        sentence("b", 0.25),
        sentence("c", 1, 1, { sourcePageCount: 4, translationPageCount: 4 }),
      ],
      paneHeight: 0.25,
    });
    expect(result.pages).toHaveLength(5);
    expect(result.pages[0].unitIndexes).toEqual([0, 1]);
    expect(result.pages.every((page) => page.usedHeight <= 0.25)).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  it("returns no demand when given a zero-page budget or an empty range", () => {
    const noBudget = paginatePairs({
      units: [sentence("a", 20, null)],
      paneHeight: 100,
      maxPages: 0,
    });
    expect(noBudget.pages).toEqual([]);
    expect(noBudget.nextMissingUnitId).toBeNull();
    expect(noBudget.isComplete).toBe(false);
    const empty = paginatePairs({ units: [], paneHeight: 100 });
    expect(empty.pages).toEqual([]);
    expect(empty.isComplete).toBe(true);
  });

  it("rejects unusable measurements and options", () => {
    expect(() => paginatePairs({ units: [], paneHeight: 0 })).toThrow(
      RangeError,
    );
    expect(() => paginatePairs({ units: [], paneHeight: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() =>
      paginatePairs({ units: [], paneHeight: 100, rowGap: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      paginatePairs({ units: [], paneHeight: 100, startUnitIndex: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      paginatePairs({ units: [], paneHeight: 100, maxPages: 1.5 }),
    ).toThrow(RangeError);
    expect(() =>
      paginatePairs({ units: [sentence("a", -1)], paneHeight: 100 }),
    ).toThrow(RangeError);
  });
});
