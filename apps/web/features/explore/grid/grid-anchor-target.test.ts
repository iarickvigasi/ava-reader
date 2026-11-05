import { expect, it } from "vitest";
import { gridAnchorTarget } from "./grid-anchor-target";
import type { CatalogWork } from "@/lib/catalog-types";

const books = Array.from(
  { length: 100 },
  (_, index) => ({ id: String(index) }) as CatalogWork,
);
const viewport = {
  columns: 4,
  rowHeight: 400,
  top: 500,
  scroll: 2500,
  height: 800,
};
it("keeps a book row fixed while earlier pages are evicted or prepended", () => {
  expect(gridAnchorTarget(books, books.slice(8), viewport, viewport)).toBe(
    1700,
  );
  expect(gridAnchorTarget(books.slice(8), books, viewport, viewport)).toBe(
    3300,
  );
});
it("preserves the visible work after a responsive column change", () => {
  expect(
    gridAnchorTarget(books, books, viewport, {
      ...viewport,
      columns: 2,
      rowHeight: 300,
    }),
  ).toBe(3500);
});
it("does not invent an anchor when the work was deleted", () => {
  expect(
    gridAnchorTarget(books, books.slice(40), viewport, viewport),
  ).toBeNull();
});
