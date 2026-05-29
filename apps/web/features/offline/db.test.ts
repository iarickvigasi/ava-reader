import { afterEach, beforeEach, describe, expect, it } from "vitest";

// fake-indexeddb gives Dexie a real IDB to run against under Node — no
// jsdom needed. The auto import installs the globals (indexedDB,
// IDBKeyRange, …) before Dexie touches them.
import "fake-indexeddb/auto";

import {
  __resetDbForTests,
  DB_NAME,
  getDb,
  SCHEMA_VERSION,
} from "./db";

beforeEach(async () => {
  __resetDbForTests();
  // Delete and recreate the underlying IDB database so each test starts
  // from a clean slate even when several tests share a fake-indexeddb
  // process.
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
});

describe("offline db", () => {
  it("opens at the declared schema version", async () => {
    const db = getDb();
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
  });

  it("returns the same instance across getDb() calls", () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it("__resetDbForTests creates a fresh instance", () => {
    const a = getDb();
    __resetDbForTests();
    const b = getDb();
    expect(a).not.toBe(b);
  });

  it("stores and reads back a library item", async () => {
    const db = getDb();
    await db.libraryItems.put({
      libraryItemId: "lib-1",
      slug: "book-1",
      title: "Crime & Punishment",
      authors: ["Dostoevsky"],
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
    const round = await db.libraryItems.get("lib-1");
    expect(round?.title).toBe("Crime & Punishment");
  });

  it("compound-key tables index by their composite", async () => {
    const db = getDb();
    await db.bookChapters.put({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
      aux: null,
      fetchedAt: "2026-01-01T00:00:00Z",
    });
    const row = await db.bookChapters.get(["lib-1", "ch-1"]);
    expect(row?.index).toBe(0);
  });
});
