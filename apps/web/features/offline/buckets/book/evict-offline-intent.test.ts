import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";

import { __resetDbForTests, getDb } from "../../db";
import { evictStaleAutoSaves } from "./evict";
import { markBookSaved } from "./storage";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it.each([false, true])(
  "protects offline intent after auto-save (dirty: %s) until intent is cleared",
  async (offlineRequestedDirty) => {
    const db = getDb();
    const coverBlob = new Blob(["cover"], { type: "image/png" });
    for (const libraryItemId of ["kept", "ordinary", "current"]) {
      await db.libraryItems.put({
        libraryItemId,
        slug: libraryItemId,
        title: "Title",
        authors: [],
        coverImageUrl: null,
        completionPercent: 0,
        primaryFormat: "EPUB",
        lastReadAt: null,
        coverBlob,
        savedOffline: false,
        savedAutomatically: false,
        savedAt: null,
        offlineRequested: libraryItemId === "kept",
        offlineRequestedDirty,
        serverUpdatedAt: null,
      });
      await db.books.put({
        libraryItemId,
        toc: [],
        chapterIds: ["ch-1"],
        metadata: { libraryItemId },
        fetchedAt: "2026-09-24T00:00:00Z",
      });
      await db.bookChapters.put({
        libraryItemId,
        chapterId: "ch-1",
        index: 0,
        blocks: [],
        aux: null,
        fetchedAt: "2026-09-24T00:00:00Z",
      });
      await markBookSaved(libraryItemId, "auto");
    }

    expect(await db.libraryItems.get("kept")).toMatchObject({
      savedAutomatically: true,
      savedOffline: false,
      offlineRequested: true,
    });
    expect(await evictStaleAutoSaves("current")).toEqual(["ordinary"]);
    expect(await db.books.get("kept")).toBeDefined();
    expect(await db.bookChapters.get(["kept", "ch-1"])).toBeDefined();
    expect((await db.libraryItems.get("kept"))?.coverBlob).toEqual(coverBlob);
    expect(await db.books.get("current")).toBeDefined();
    expect(await db.books.get("ordinary")).toBeUndefined();
    expect(await db.bookChapters.get(["ordinary", "ch-1"])).toBeUndefined();
    expect((await db.libraryItems.get("ordinary"))?.coverBlob).toBeNull();

    await db.libraryItems.update("kept", { offlineRequested: false });
    expect(await evictStaleAutoSaves("current")).toEqual(["kept"]);
    expect(await db.books.get("kept")).toBeUndefined();
    expect(await db.bookChapters.get(["kept", "ch-1"])).toBeUndefined();
    expect((await db.libraryItems.get("kept"))?.coverBlob).toBeNull();
  },
);
