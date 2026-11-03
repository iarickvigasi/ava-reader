import { expect, it } from "vitest";
import { virtualCatalogRange } from "./virtual-catalog-range";

it.each([2, 3, 4, 5])(
  "bounds rendered rows over 10,000 books at %i columns",
  (columns) => {
    for (const offset of [0, 5000, 100_000]) {
      const rows = virtualCatalogRange(10_000, columns, 400, offset, 800);
      expect(rows.length).toBeLessThanOrEqual(7);
      expect(rows).toContain(Math.floor(offset / 400));
    }
  },
);
it("keeps an offscreen focused row mounted without rendering intermediate rows", () => {
  expect(virtualCatalogRange(10_000, 4, 400, 0, 800, 9999)).toEqual([
    0, 1, 2, 3, 2499,
  ]);
});
it("handles empty results and viewport offsets above the grid", () => {
  expect(virtualCatalogRange(0, 4, 400, 0, 800)).toEqual([]);
  expect(virtualCatalogRange(20, 4, 400, -500, 800)).toEqual([0, 1, 2, 3]);
});
