import { expect, it } from "vitest";
import type { CatalogWork } from "@/lib/catalog-types";
import { mergeCatalogPages, uniqueCatalogWorks } from "./merge-catalog-pages";

const work = (id: string): CatalogWork => ({
  id,
  originalTitle: id,
  originalLanguage: null,
  texts: [],
  credits: [],
});

it("keeps existing cards when appending and deduplicates overlapping cursor results", () => {
  const first = {
    cursor: null,
    page: { items: [work("a"), work("b")], nextCursor: "b" },
  };
  const second = {
    cursor: "b",
    page: { items: [work("b"), work("c")], nextCursor: null },
  };
  const pages = mergeCatalogPages([first], second);
  expect(uniqueCatalogWorks(pages).map((item) => item.id)).toEqual([
    "a",
    "b",
    "c",
  ]);
  expect(first.page.items).toHaveLength(2);
});

it("replaces a revalidated page instead of appending a duplicate page", () => {
  const first = {
    cursor: null,
    page: { items: [work("a")], nextCursor: null },
  };
  const incoming = {
    ...first,
    page: {
      ...first.page,
      items: [{ ...work("a"), originalTitle: "Updated" }],
    },
  };
  const pages = mergeCatalogPages([first], incoming);
  expect(pages).toHaveLength(1);
  expect(uniqueCatalogWorks(pages)[0].originalTitle).toBe("Updated");
});
