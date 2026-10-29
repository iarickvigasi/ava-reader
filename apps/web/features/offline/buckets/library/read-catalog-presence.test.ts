import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  __resetDbForTests,
  dbNameForUser,
  getDb,
  setActiveUser,
} from "../../db";
import { hydrateFromPayload, __resetLibraryBucketForTests } from "./bucket";
import { payload } from "./test-fixture";
import { readCatalogPresence } from "./read-catalog-presence";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await Dexie.delete(dbNameForUser("featured-presence"));
  setActiveUser("featured-presence");
});
afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

it("remembers acquired books across reads and checks that the copy still exists", async () => {
  const db = getDb();
  expect(await readCatalogPresence("entry")).toBe(false);
  await hydrateFromPayload(payload());
  await db.meta.put({
    key: "catalog-reading-copy:entry",
    value: { libraryItemId: "lib-1" },
    updatedAt: "2026-10-29",
  });
  expect(await readCatalogPresence("entry")).toBe(true);
  await db.libraryItems.delete("lib-1");
  expect(await readCatalogPresence("entry")).toBe(false);
});

it("uses server membership before hydration but honors local deletion", async () => {
  expect(await readCatalogPresence("entry", "lib-1")).toBe(true);
  await getDb().meta.put({
    key: "deleted-library-item:lib-1",
    value: true,
    updatedAt: "2026-10-29",
  });
  expect(await readCatalogPresence("entry", "lib-1")).toBe(false);
});

it("accepts a fresh server copy after the previous acquired copy was deleted", async () => {
  const db = getDb();
  await db.meta.put({
    key: "catalog-reading-copy:entry",
    value: { libraryItemId: "old-copy" },
    updatedAt: "2026-10-29",
  });
  await db.meta.put({
    key: "deleted-library-item:old-copy",
    value: true,
    updatedAt: "2026-10-29",
  });
  expect(await readCatalogPresence("entry", "new-copy")).toBe(true);
});
