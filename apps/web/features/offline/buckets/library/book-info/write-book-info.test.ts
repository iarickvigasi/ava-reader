import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests, getDb } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { applyBookInfoPayload } from "./write-book-info";
import { applyLibraryPayload } from "../collections/write-library";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

describe("applyBookInfoPayload", () => {
  it("preserves the server-synced offline intent when book-info re-hydrates", async () => {
    const db = getDb();
    // A library payload marks book-a as offlineRequested.
    await applyLibraryPayload({
      summary: { booksCount: 1, collectionsCount: 1 },
      collections: [
        {
          id: "col-1",
          slug: "imported",
          kind: "SMART",
          name: "Imported",
          description: null,
          smartKey: "imported-library",
          itemCount: 1,
          unreadCount: 0,
          books: [
            {
              libraryItemId: "lib-1",
              slug: "book-a",
              title: "Book A",
              authors: ["A"],
              coverImageUrl: null,
              completionPercent: 0,
              primaryFormat: "EPUB",
              lastReadAt: "2026-01-01T00:00:00Z",
              offlineRequested: true,
            },
          ],
        },
      ],
    });
    expect((await db.libraryItems.get("lib-1"))?.offlineRequested).toBe(true);

    // A book-info revalidation must NOT wipe the offline intent.
    await applyBookInfoPayload({
      libraryItemId: "lib-1",
      slug: "book-a",
      title: "Book A",
      authors: ["A"],
      coverImageUrl: null,
      completionPercent: 0,
      primaryFormat: "EPUB",
      offlineRequested: true,
      addedAt: "2026-01-01T00:00:00Z",
      approximateBodyPageCount: null,
      approximatePageCount: null,
      chapterLabel: null,
      collections: [],
      description: null,
      genres: [],
      finishedAt: null,
      language: null,
      lastReadAt: null,
      minutesRead: 0,
      publishedYear: null,
      source: "IMPORTED",
    });
    expect((await db.libraryItems.get("lib-1"))?.offlineRequested).toBe(true);
  });
});
