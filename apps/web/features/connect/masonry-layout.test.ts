import { expect, it } from "vitest";
import { masonryColumns, masonryLayout } from "./masonry-layout";

it("uses full-width mobile cards and adds columns only when they fit", () => {
  expect(masonryColumns(280)).toEqual({ count: 1, cardWidth: 280 });
  expect(masonryColumns(655).count).toBe(1);
  expect(masonryColumns(656)).toEqual({ count: 2, cardWidth: 320 });
  expect(masonryColumns(1100)).toEqual({ count: 3, cardWidth: 356 });
});

it("places the next reader below the shortest column without stretching cards", () => {
  expect(masonryLayout(700, [400, 100, 200, 80])).toEqual({
    positions: [
      { left: 0, top: 0 },
      { left: 358, top: 0 },
      { left: 358, top: 116 },
      { left: 358, top: 332 },
    ],
    height: 412,
  });
});

it("keeps one-column order and omits a trailing gap", () => {
  expect(masonryLayout(300, [50, 100])).toEqual({
    positions: [
      { left: 0, top: 0 },
      { left: 0, top: 66 },
    ],
    height: 166,
  });
  expect(masonryLayout(1000, []).height).toBe(0);
});
