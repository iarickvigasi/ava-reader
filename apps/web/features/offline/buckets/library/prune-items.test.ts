import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import { __resetLibraryBucketForTests } from "./bucket";
import { setOfflineRequestedLocal } from "./offline-intent/offline-intent-store";
import { pruneLibraryItems } from "./prune-items";
import { payload } from "./test-fixture";
import { applyCollectionPayload } from "./collections/write-library";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

describe("pruneLibraryItems", () => {
  it("prunes only on an explicit complete-pass keep set", async () => {
    await applyCollectionPayload(payload().collections[0]);
    const db = getDb();

    await pruneLibraryItems(["lib-1"]);

    expect(await db.libraryItems.get("lib-2")).toBeUndefined();
    expect(await db.libraryItems.get("lib-1")).toBeDefined();
    // Membership for the pruned book goes with it.
    const links = await db.collectionMembership.toArray();
    expect(links.map((l) => l.libraryItemId)).toEqual(["lib-1"]);
  });

  it("never prunes a row with an unsynced offline toggle", async () => {
    await applyCollectionPayload(payload().collections[0]);
    await setOfflineRequestedLocal("lib-2", true);

    await pruneLibraryItems(["lib-1"]);

    const row = await getDb().libraryItems.get("lib-2");
    expect(row?.offlineRequestedDirty).toBe(true);
  });
});
