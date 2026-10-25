import { expect, it } from "vitest";
import type {
  LibraryCollection,
  LibraryCollectionBook,
  LibraryPayload,
} from "@/lib/api-types";
import { filterLibraryScreen } from "./filter-library-screen";

const books: LibraryCollectionBook[] = Array.from({ length: 7 }, (_, i) => ({
  libraryItemId: String(i),
  slug: String(i),
  title: String(i),
  authors: [],
  coverImageUrl: null,
  primaryFormat: "EPUB",
  lastReadAt: "2026-10-25",
  completionPercent: i === 5 ? 100 : 0,
}));
const collection: LibraryCollection = {
  id: "c",
  slug: "c",
  name: "C",
  description: null,
  kind: "CUSTOM",
  smartKey: null,
  itemCount: 6,
  unreadCount: 5,
  books: books.slice(0, 4),
  completionItems: books
    .slice(0, 6)
    .map((book) => ({ ...book, finishedAt: null })),
};
const library: LibraryPayload = {
  books,
  collections: [collection],
  summary: { booksCount: 7, collectionsCount: 1 },
};
it("filters complete membership before limiting the preview", () => {
  const result = filterLibraryScreen(library, null, ["done"]);
  expect(result.collections[0].books.map((book) => book.libraryItemId)).toEqual(
    ["5"],
  );
  expect(result.collections[0].itemCount).toBe(1);
  expect(result.collections[0].unreadCount).toBe(0);
  expect(result.books).toEqual([]);
  expect(library.summary.booksCount).toBe(7);
});
it("keeps uncollected books separate from collection contents", () => {
  expect(
    filterLibraryScreen(library, null, []).books.map(
      (book) => book.libraryItemId,
    ),
  ).toEqual(["6"]);
});
it("hides empty sections only while filtering", () => {
  const empty = {
    ...library,
    collections: [
      { ...collection, books: [], completionItems: [], itemCount: 0 },
    ],
  };
  expect(filterLibraryScreen(empty, null, []).collections).toHaveLength(1);
  expect(filterLibraryScreen(empty, null, ["done"]).collections).toHaveLength(
    0,
  );
});

it("shows matching unassigned books and only collections with matching members", () => {
  const mixed: LibraryPayload = {
    ...library,
    books: books.map((book) => ({
      ...book,
      completionPercent:
        book.libraryItemId === "6" ? 100 : book.completionPercent,
    })),
    collections: [
      collection,
      {
        ...collection,
        id: "unmatched",
        books: [books[0]],
        completionItems: [{ ...books[0], finishedAt: null }],
        itemCount: 1,
        unreadCount: 1,
      },
    ],
  };
  const result = filterLibraryScreen(mixed, null, ["done"]);
  expect(result.books.map((book) => book.libraryItemId)).toEqual(["6"]);
  expect(result.collections.map((row) => row.id)).toEqual(["c"]);
  expect(result.collections[0].books.map((book) => book.libraryItemId)).toEqual(
    ["5"],
  );
});
