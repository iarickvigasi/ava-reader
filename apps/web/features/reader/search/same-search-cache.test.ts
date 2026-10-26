import { expect, it } from "vitest";
import { sameSearchCache } from "./same-search-cache";

it("keeps unchanged cache notifications from restarting a pending search", () => {
  const chapter = {
    libraryItemId: "book",
    chapterId: "c",
    index: 0,
    blocks: [],
    aux: undefined,
    fetchedAt: "first",
  };
  const previous = { chapters: [chapter] };
  expect(sameSearchCache(previous, { chapters: [{ ...chapter }] })).toBe(true);
  expect(
    sameSearchCache(previous, {
      chapters: [{ ...chapter, fetchedAt: "updated" }],
    }),
  ).toBe(false);
  expect(sameSearchCache(previous, { chapters: [] })).toBe(false);
});
