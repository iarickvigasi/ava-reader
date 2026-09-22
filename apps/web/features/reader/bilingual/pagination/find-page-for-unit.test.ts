import { describe, expect, it } from "vitest";
import { paginatePairs, findBilingualPageForUnit } from "./paginate-pairs";
import { sentence } from "./test-fixture";

describe("bilingual page anchor lookup", () => {
  const pages = paginatePairs({
    units: [sentence("a", 20), sentence("b", 220, 20, { sourcePageCount: 3 })],
    paneHeight: 100,
  }).pages;

  it("restores a sentence's continuation after repagination", () => {
    expect(findBilingualPageForUnit(pages, 0)).toBe(0);
    expect(findBilingualPageForUnit(pages, 1)).toBe(1);
    expect(findBilingualPageForUnit(pages, 1, 2)).toBe(3);
  });

  it("clamps a continuation that disappeared during reflow and rejects unknown anchors", () => {
    expect(findBilingualPageForUnit(pages, 1, 7)).toBe(3);
    expect(findBilingualPageForUnit(pages, 9)).toBeNull();
  });
});
