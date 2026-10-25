import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryPayload } from "@/lib/api-types/library";

import { DB_NAME, __resetDbForTests } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { readCollectionViewBySlug, readLibraryView } from "./read-library";
import { payload } from "../test-fixture";
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

describe("library reads", () => {
  it("reads back what it writes", async () => {
    await applyLibraryPayload(payload());
    const view = await readLibraryView();
    expect(view).not.toBeNull();
    expect(view!.collections).toHaveLength(1);
    expect(view!.collections[0].books).toHaveLength(2);
    expect(view!.collections[0].books[0].title).toBe("Book A");
  });

  it("reads collections back in display order, not Dexie's key order", async () => {
    // Ids are deliberately ascending in the opposite order to the display
    // rule, so a passing test can only mean the sort ran: Dexie returns rows
    // by primary key. Both shelves hold the same freshly-read book, so the
    // item count is what separates them.
    const justOpened = {
      libraryItemId: "lib-1",
      slug: "book-a",
      title: "Book A",
      authors: ["A"],
      coverImageUrl: null,
      completionPercent: 10,
      primaryFormat: "EPUB" as const,
      lastReadAt: "2026-08-30T00:00:00Z",
    };
    const base = payload().collections[0];
    await applyLibraryPayload({
      summary: { booksCount: 1, collectionsCount: 3 },
      collections: [
        {
          ...base,
          id: "col-a",
          slug: "broad",
          name: "Broad",
          itemCount: 9,
          books: [justOpened],
        },
        {
          ...base,
          id: "col-b",
          slug: "empty",
          name: "Empty",
          itemCount: 0,
          books: [],
        },
        {
          ...base,
          id: "col-c",
          slug: "narrow",
          name: "Narrow",
          itemCount: 1,
          books: [justOpened],
        },
      ],
    });

    const view = await readLibraryView();

    expect(view!.collections.map((collection) => collection.name)).toEqual([
      "Narrow",
      "Broad",
      "Empty",
    ]);
  });

  it("reports the server's book total, not the number of cached rows", async () => {
    // The overview payload carries only a per-collection preview, so counting
    // cached rows would report 2 for a 9-book library.
    const previewOnly: LibraryPayload = {
      ...payload(),
      summary: { booksCount: 9, collectionsCount: 1 },
      collections: [
        { ...payload().collections[0], itemCount: 9, unreadCount: 8 },
      ],
    };
    await applyLibraryPayload(previewOnly);

    const view = await readLibraryView();
    expect(view!.summary.booksCount).toBe(9);
  });

  it("falls back to the cached row count when no server total is stored", async () => {
    // A cache seeded only by a collection-page visit carries no library-wide
    // summary; the count degrades to the rows on hand rather than to zero.
    await applyCollectionPayload(payload().collections[0]);

    const view = await readLibraryView();
    expect(view!.summary.booksCount).toBe(2);
  });

  it("readCollectionViewBySlug returns null for unknown slug", async () => {
    await applyLibraryPayload(payload());
    const view = await readCollectionViewBySlug("nope");
    expect(view).toBeNull();
  });
});
