import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests, clearAllDexieUserData, getDb } from "../db";

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

describe("clearAllDexieUserData", () => {
  it("wipes every user-scoped table in one transaction", async () => {
    const db = getDb();
    // Seed at least one row in every table so the wipe has work to do.
    await db.me.put({
      id: "me",
      user: {
        id: "u1",
        clerkUserId: "c1",
        email: "x@y.z",
        displayName: "X",
        avatarUrl: null,
        role: "USER",
      },
      fetchedAt: "2026-04-12T10:00:00Z",
    });
    await db.libraryItems.put({
      libraryItemId: "lib-1",
      slug: "x",
      title: "X",
      authors: [],
      coverImageUrl: null,
      completionPercent: 0,
      primaryFormat: "EPUB",
      lastReadAt: null,
      coverBlob: null,
      savedOffline: false,
      savedAutomatically: false,
      savedAt: null,
      serverUpdatedAt: null,
    });
    await db.highlights.put({
      libraryItemId: "lib-1",
      id: "h1",
      excerpt: "x",
      color: "apricot",
      locator: null,
      createdAt: "2026-04-12T10:00:00Z",
      updatedAt: "2026-04-12T10:00:00Z",
    });
    await db.preferences.put({
      id: "me",
      values: { theme: "dark" },
      dirtyFields: ["theme"],
      serverUpdatedAt: null,
    });
    await db.sessions.put({
      clientSessionId: "cs-1",
      serverSessionId: null,
      libraryItemId: "lib-1",
      startedAt: "2026-04-12T10:00:00.000Z",
      endedAt: "2026-04-12T10:10:00.000Z",
      lastHeartbeatAt: "2026-04-12T10:10:00.000Z",
      state: "closed",
      syncedAt: null,
    });

    // Sanity check — seeds landed.
    expect(await db.me.count()).toBe(1);
    expect(await db.libraryItems.count()).toBe(1);
    expect(await db.highlights.count()).toBe(1);
    expect(await db.preferences.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);

    await clearAllDexieUserData();

    // Every table empty.
    expect(await db.me.count()).toBe(0);
    expect(await db.libraryItems.count()).toBe(0);
    expect(await db.highlights.count()).toBe(0);
    expect(await db.preferences.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.highlightMutations.count()).toBe(0);
    expect(await db.aiCommentMutations.count()).toBe(0);
  });

  it("is a no-op when the DB is already empty", async () => {
    await clearAllDexieUserData();
    expect(await getDb().me.count()).toBe(0);
  });
});
