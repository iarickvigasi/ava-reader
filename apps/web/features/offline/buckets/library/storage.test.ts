import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryBookInfo, LibraryPayload } from "@/lib/api-types/library";

import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import { __resetLibraryBucketForTests } from "./bucket";
import {
  applyBookInfoPayload,
  applyCollectionPayload,
  applyLibraryPayload,
  readBookInfoBySlug,
  readCollectionViewBySlug,
  readLibraryView,
} from "./storage";

function payload(): LibraryPayload {
  return {
    summary: { booksCount: 2, collectionsCount: 1 },
    collections: [
      {
        id: "col-1",
        slug: "favs",
        kind: "CUSTOM",
        name: "Favorites",
        description: null,
        smartKey: null,
        itemCount: 2,
        unreadCount: 1,
        books: [
          {
            libraryItemId: "lib-1",
            slug: "book-a",
            title: "Book A",
            authors: ["A"],
            coverImageUrl: null,
            completionPercent: 10,
            primaryFormat: "EPUB",
            lastReadAt: "2026-01-01T00:00:00Z",
          },
          {
            libraryItemId: "lib-2",
            slug: "book-b",
            title: "Book B",
            authors: ["B"],
            coverImageUrl: null,
            completionPercent: 0,
            primaryFormat: "EPUB",
            lastReadAt: "2026-01-02T00:00:00Z",
          },
        ],
      },
    ],
  };
}

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

describe("library bucket storage", () => {
  it("reads back what it writes", async () => {
    await applyLibraryPayload(payload());
    const view = await readLibraryView();
    expect(view).not.toBeNull();
    expect(view!.collections).toHaveLength(1);
    expect(view!.collections[0].books).toHaveLength(2);
    expect(view!.collections[0].books[0].title).toBe("Book A");
  });

  it("preserves savedOffline across a re-hydration", async () => {
    await applyLibraryPayload(payload());
    const db = getDb();
    // Simulate the user saving a book offline (a phase-2 flow); the next
    // server payload that arrives must NOT stomp the flag.
    await db.libraryItems.update("lib-1", {
      savedOffline: true,
      savedAt: "2026-01-03T00:00:00Z",
    });
    await applyLibraryPayload(payload());
    const row = await db.libraryItems.get("lib-1");
    expect(row?.savedOffline).toBe(true);
    expect(row?.savedAt).toBe("2026-01-03T00:00:00Z");
  });

  it("drops collections/books removed by a fresh payload", async () => {
    await applyLibraryPayload(payload());
    const trimmed: LibraryPayload = {
      ...payload(),
      collections: [
        {
          ...payload().collections[0],
          itemCount: 1,
          unreadCount: 0,
          books: payload().collections[0].books.slice(0, 1),
        },
      ],
    };
    await applyLibraryPayload(trimmed);
    const view = await readLibraryView();
    expect(view!.collections[0].books.map((b) => b.libraryItemId)).toEqual([
      "lib-1",
    ]);
  });

  it("readCollectionViewBySlug returns null for unknown slug", async () => {
    await applyLibraryPayload(payload());
    const view = await readCollectionViewBySlug("nope");
    expect(view).toBeNull();
  });

  it("applyCollectionPayload updates a single collection without touching others", async () => {
    await applyLibraryPayload(payload());
    const extraCollection = {
      id: "col-2",
      slug: "later",
      kind: "CUSTOM" as const,
      name: "Read Later",
      description: null,
      smartKey: null,
      itemCount: 1,
      unreadCount: 1,
      books: [
        {
          libraryItemId: "lib-3",
          slug: "book-c",
          title: "Book C",
          authors: ["C"],
          coverImageUrl: null,
          completionPercent: 0,
          primaryFormat: "EPUB" as const,
          lastReadAt: "2026-01-04T00:00:00Z",
        },
      ],
    };
    await applyCollectionPayload(extraCollection);
    const favs = await readCollectionViewBySlug("favs");
    const later = await readCollectionViewBySlug("later");
    expect(favs?.books.map((b) => b.libraryItemId)).toEqual(["lib-1", "lib-2"]);
    expect(later?.books.map((b) => b.libraryItemId)).toEqual(["lib-3"]);
  });

  it("caches and reads back book-info details", async () => {
    const book: LibraryBookInfo = {
      libraryItemId: "lib-9",
      slug: "war-and-peace",
      title: "War and Peace",
      authors: ["Tolstoy"],
      coverImageUrl: null,
      completionPercent: 12,
      primaryFormat: "EPUB",
      addedAt: "2026-01-01T00:00:00Z",
      approximatePageCount: 1296,
      chapterLabel: "Volume One, Part One, Chapter 1",
      collections: [{ id: "col-1", kind: "CUSTOM", name: "Favorites", smartKey: null }],
      description: "Epic of Russian society during the Napoleonic era.",
      genres: ["Fiction", "Classic"],
      language: "ru",
      lastReadAt: "2026-02-01T00:00:00Z",
      minutesRead: 240,
      publishedYear: 1869,
      source: "CATALOG",
    };
    await applyBookInfoPayload(book);
    const round = await readBookInfoBySlug("war-and-peace");
    expect(round).toEqual(book);
  });

  it("preserves cached details when the library payload re-hydrates", async () => {
    // Visit the book-info page first (writes details).
    const book: LibraryBookInfo = {
      libraryItemId: "lib-1",
      slug: "book-a",
      title: "Book A",
      authors: ["A"],
      coverImageUrl: null,
      completionPercent: 10,
      primaryFormat: "EPUB",
      addedAt: "2026-01-01T00:00:00Z",
      approximatePageCount: 200,
      chapterLabel: null,
      collections: [],
      description: "Description for A",
      genres: ["Fiction"],
      language: "en",
      lastReadAt: null,
      minutesRead: 12,
      publishedYear: 2020,
      source: "IMPORTED",
    };
    await applyBookInfoPayload(book);
    // Now a list re-hydration arrives — it must not wipe `details`.
    await applyLibraryPayload(payload());
    const round = await readBookInfoBySlug("book-a");
    expect(round?.description).toBe("Description for A");
    expect(round?.minutesRead).toBe(12);
  });

  it("readBookInfoBySlug returns null when details have never been fetched", async () => {
    // Listing alone (no book-info visit) doesn't populate details.
    await applyLibraryPayload(payload());
    const round = await readBookInfoBySlug("book-a");
    expect(round).toBeNull();
  });
});
