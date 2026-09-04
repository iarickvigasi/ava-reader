import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryPayload } from "@/lib/api-types/library";

import { DB_NAME, __resetDbForTests } from "../../db";
import { __resetLibraryBucketForTests } from "./bucket";
import { setOfflineRequestedLocal } from "./offline-intent-store";
import { readCollectionViewBySlug, readLibraryView } from "./read-library";
import { offlineShelfPayload, payload } from "./test-fixture";
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

  it("reports the offline shelf's whole count, not just its cached previews", async () => {
    const saved = {
      ...payload().collections[0].books[0],
      offlineRequested: true,
    };
    const offlineShelf = {
      ...payload().collections[0],
      id: "col-offline",
      slug: "offline-books",
      kind: "SMART" as const,
      name: "Offline Books",
      smartKey: "offline-books",
      // The server says twelve; a library payload only ever ships four.
      itemCount: 12,
      unreadCount: 7,
      books: [saved],
    };
    await applyLibraryPayload({
      summary: { booksCount: 12, collectionsCount: 1 },
      collections: [offlineShelf],
    });

    const view = await readLibraryView();

    expect(view!.collections[0]).toMatchObject({
      itemCount: 12,
      unreadCount: 7,
    });
    expect(view!.collections[0].books).toHaveLength(1);
  });

  it("moves the offline count by one when a book is toggled locally", async () => {
    const unsaved = payload().collections[0].books[0];
    await applyLibraryPayload({
      summary: { booksCount: 12, collectionsCount: 1 },
      collections: [
        {
          ...payload().collections[0],
          id: "col-offline",
          slug: "offline-books",
          kind: "SMART" as const,
          name: "Offline Books",
          smartKey: "offline-books",
          itemCount: 12,
          unreadCount: 7,
          books: [{ ...unsaved, offlineRequested: false }],
        },
      ],
    });

    await setOfflineRequestedLocal(unsaved.libraryItemId, true);
    const saved = await readLibraryView();
    expect(saved!.collections[0]).toMatchObject({
      itemCount: 13,
      unreadCount: 8,
    });

    await setOfflineRequestedLocal(unsaved.libraryItemId, false);
    const released = await readLibraryView();
    expect(released!.collections[0]).toMatchObject({
      itemCount: 12,
      unreadCount: 7,
    });
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

function readShelf(view: Awaited<ReturnType<typeof readLibraryView>>) {
  return view!.collections.find(
    (collection) => collection.smartKey === "offline-books",
  )!;
}

describe("offline books shelf", () => {
  it("lists the offlineRequested books, newest engagement first", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    const shelf = readShelf(await readLibraryView());
    expect(shelf.books.map((book) => book.libraryItemId)).toEqual(["lib-1"]);
  });

  it("picks up a save made offline before the PATCH flushes", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    // The user saves Book B while disconnected: the flag flips locally and is
    // marked dirty, but no membership row for it has arrived from the server.
    await setOfflineRequestedLocal("lib-2", true);

    const shelf = readShelf(await readLibraryView());
    expect(shelf.books.map((book) => book.libraryItemId)).toEqual([
      "lib-2",
      "lib-1",
    ]);
  });

  it("drops a book released offline while the cached rows still list it", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    await setOfflineRequestedLocal("lib-1", false);

    const shelf = readShelf(await readLibraryView());
    expect(shelf.books).toHaveLength(0);
  });

  it("derives its counts rather than trusting the payload's", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    await setOfflineRequestedLocal("lib-2", true);

    const shelf = readShelf(await readLibraryView());
    // Payload said 1/1; both books are now requested and neither is finished.
    expect(shelf.itemCount).toBe(2);
    expect(shelf.unreadCount).toBe(2);
  });

  it("derives the same set when read by slug", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    await setOfflineRequestedLocal("lib-2", true);

    const shelf = await readCollectionViewBySlug("offline-books");
    expect(shelf!.books.map((book) => book.libraryItemId)).toEqual([
      "lib-2",
      "lib-1",
    ]);
  });

  it("leaves other collections reading from their membership rows", async () => {
    await applyLibraryPayload(offlineShelfPayload());
    await setOfflineRequestedLocal("lib-2", true);

    const view = await readLibraryView();
    const favorites = view!.collections.find(
      (collection) => collection.slug === "favs",
    );
    expect(favorites!.books).toHaveLength(2);
    expect(favorites!.itemCount).toBe(2);
  });
});
