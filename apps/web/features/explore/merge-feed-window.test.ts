import { expect, it } from "vitest";
import {
  mergeFeedWindow,
  trimFeedWindow,
  FEED_PAGE_LIMIT,
} from "./merge-feed-window";
import type { LoadedCatalogPage } from "./merge-catalog-pages";
import type { CatalogWork } from "@/lib/catalog-types";

const page = (number: number, before?: string): LoadedCatalogPage => ({
  cursor: before ? null : String(number),
  before,
  page: {
    items: [{ id: String(number) } as CatalogWork],
    nextCursor: String(number + 1),
    previousCursor: number ? String(number - 1) : null,
  },
});
it("keeps page bodies bounded over 10,000 books and supports reverse paging", () => {
  let pages: LoadedCatalogPage[] = [];
  for (let index = 0; index < 10_000; index++)
    pages = mergeFeedWindow(pages, page(index), []);
  expect(pages).toHaveLength(FEED_PAGE_LIMIT);
  expect(pages[0].page.items[0].id).toBe("9995");
  pages = mergeFeedWindow(pages, page(9994, "9995"), []);
  expect(pages.map((entry) => entry.page.items[0].id)).toEqual([
    "9994",
    "9995",
    "9996",
    "9997",
    "9998",
  ]);
});
it("temporarily preserves a focused or visible edge, then evicts it after it is released", () => {
  const pages = Array.from({ length: 5 }, (_, index) => page(index));
  const pinned = mergeFeedWindow(pages, page(5), ["0"]);
  expect(pinned).toHaveLength(6);
  expect(trimFeedWindow(pinned, false, [])).toHaveLength(5);
});
it("does not evict actual books for an empty boundary response", () => {
  const pages = [page(1), page(2)];
  const incoming = { ...page(3), page: { items: [], nextCursor: null } };
  const result = mergeFeedWindow(pages, incoming, []);
  expect(result).toHaveLength(2);
  expect(result.at(-1)?.page.nextCursor).toBeNull();
});

it("discards dependent windows when revalidation changes page boundaries", () => {
  const pages = [page(1), page(2), page(3)];
  const replacement = {
    ...page(2),
    page: { ...page(2).page, nextCursor: "different" },
  };
  expect(mergeFeedWindow(pages, replacement, [])).toEqual([replacement]);
});
