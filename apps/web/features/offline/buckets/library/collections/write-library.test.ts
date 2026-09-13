import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryBookInfo, LibraryPayload } from "@/lib/api-types/library";

import { DB_NAME, __resetDbForTests, getDb } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { readBookInfoBySlug } from "../book-info/read-book-info";
import { readCollectionViewBySlug, readLibraryView } from "./read-library";
import { payload } from "../test-fixture";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { applyCollectionPayload, applyLibraryPayload } from "./write-library";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

describe("library writes", () => {
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

  // The regression: the list payload previews 4 books per collection, and a
  // clear-and-rebuild from it deleted every book outside those previews — so
  // the primer's full per-collection pass was erased by the next library
  // visit, leaving a 50-book library with 6 cached rows.

  // The regression: the list payload previews 4 books per collection, and a
  // clear-and-rebuild from it deleted every book outside those previews — so
  // the primer's full per-collection pass was erased by the next library
  // visit, leaving a 50-book library with 6 cached rows.
  it("keeps books an incomplete preview payload does not mention", async () => {
    const full = payload().collections[0];
    // The primer hydrated the shelf in full: 2 books, membership order 0,1.
    await applyCollectionPayload(full);

    // A later library-list refresh previews only the first book, but says the
    // shelf holds 2 — so it is not authoritative for the second one.
    await applyLibraryPayload({
      ...payload(),
      collections: [{ ...full, itemCount: 2, books: full.books.slice(0, 1) }],
    });

    const view = await readLibraryView();
    expect(view!.collections[0].books.map((b) => b.libraryItemId)).toEqual([
      "lib-1",
      "lib-2",
    ]);
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
      approximateBodyPageCount: null,
      approximatePageCount: 200,
      chapterLabel: null,
      collections: [],
      description: "Description for A",
      finishedAt: null,
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
});
