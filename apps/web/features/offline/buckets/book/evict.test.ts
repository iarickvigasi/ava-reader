import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DB_NAME,
  __resetDbForTests,
  getDb,
  type LibraryItemRow,
} from "../../db";
import { evictStaleAutoSaves } from "./evict";
import { readBookContent, readChapter } from "./storage";

function seedLibraryItem(
  overrides: Partial<LibraryItemRow> & { libraryItemId: string },
): LibraryItemRow {
  return {
    libraryItemId: overrides.libraryItemId,
    slug: overrides.slug ?? `slug-${overrides.libraryItemId}`,
    title: overrides.title ?? "Title",
    authors: overrides.authors ?? [],
    coverImageUrl: overrides.coverImageUrl ?? null,
    completionPercent: overrides.completionPercent ?? 0,
    primaryFormat: overrides.primaryFormat ?? "EPUB",
    lastReadAt: overrides.lastReadAt ?? null,
    coverBlob: overrides.coverBlob ?? null,
    savedOffline: overrides.savedOffline ?? false,
    savedAutomatically: overrides.savedAutomatically ?? false,
    savedAt: overrides.savedAt ?? null,
    offlineRequested: overrides.offlineRequested ?? false,
    offlineRequestedDirty: overrides.offlineRequestedDirty,
    serverUpdatedAt: overrides.serverUpdatedAt ?? null,
    details: overrides.details,
    detailsFetchedAt: overrides.detailsFetchedAt,
  };
}

async function seedContent(libraryItemId: string): Promise<void> {
  const db = getDb();
  await db.books.put({
    libraryItemId,
    toc: [],
    chapterIds: ["ch-1"],
    metadata: { libraryItemId },
    fetchedAt: "2026-01-01T00:00:00Z",
  });
  await db.bookChapters.put({
    libraryItemId,
    chapterId: "ch-1",
    index: 0,
    blocks: [],
    aux: null,
    fetchedAt: "2026-01-01T00:00:00Z",
  });
}

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("evictStaleAutoSaves", () => {
  it("drops other auto-cached books, clears their flags, and returns their ids", async () => {
    const db = getDb();
    await db.libraryItems.put(
      seedLibraryItem({ libraryItemId: "old-auto", savedAutomatically: true }),
    );
    await seedContent("old-auto");
    await db.libraryItems.put(
      seedLibraryItem({ libraryItemId: "current", savedAutomatically: true }),
    );
    await seedContent("current");

    const evicted = await evictStaleAutoSaves("current");

    expect(evicted).toEqual(["old-auto"]);
    expect(await readBookContent("old-auto")).toBeUndefined();
    expect(await readChapter("old-auto", "ch-1")).toBeUndefined();
    expect((await db.libraryItems.get("old-auto"))?.savedAutomatically).toBe(
      false,
    );
    // The currently-open book is untouched.
    expect(await readBookContent("current")).toBeDefined();
  });

  it("never evicts an explicitly-saved book", async () => {
    await getDb().libraryItems.put(
      seedLibraryItem({
        libraryItemId: "explicit",
        savedOffline: true,
        savedAutomatically: false,
      }),
    );
    await seedContent("explicit");

    const evicted = await evictStaleAutoSaves("current");

    expect(evicted).toEqual([]);
    expect(await readBookContent("explicit")).toBeDefined();
  });

  it("exempts the currently-open book even when it is auto-cached", async () => {
    await getDb().libraryItems.put(
      seedLibraryItem({ libraryItemId: "current", savedAutomatically: true }),
    );
    await seedContent("current");

    const evicted = await evictStaleAutoSaves("current");

    expect(evicted).toEqual([]);
    expect(await readBookContent("current")).toBeDefined();
  });

  it("reclaims every stale auto-cache when more than one exists (post-release)", async () => {
    const db = getDb();
    await db.libraryItems.bulkPut([
      seedLibraryItem({ libraryItemId: "released", savedAutomatically: true }),
      seedLibraryItem({ libraryItemId: "old-auto", savedAutomatically: true }),
      seedLibraryItem({ libraryItemId: "current", savedAutomatically: true }),
    ]);
    await seedContent("released");
    await seedContent("old-auto");
    await seedContent("current");

    const evicted = await evictStaleAutoSaves("current");

    expect([...evicted].sort()).toEqual(["old-auto", "released"]);
    expect(await readBookContent("released")).toBeUndefined();
    expect(await readBookContent("old-auto")).toBeUndefined();
    expect(await readBookContent("current")).toBeDefined();
  });

  it("is a no-op when there is nothing stale to drop", async () => {
    const evicted = await evictStaleAutoSaves("current");
    expect(evicted).toEqual([]);
  });
});
