import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests, getDb } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { removeCollectionFromCache } from "../remove-collection";
import { payload } from "../test-fixture";
import { applyLibraryPayload } from "./write-library";
import { readLibraryView } from "./read-library";

beforeEach(async () => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
});
afterEach(() => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
});

it("removes deleted membership intents while preserving queued edits to other collections", async () => {
  const base = payload();
  await applyLibraryPayload({ ...base, books: base.collections[0].books });
  const db = getDb();
  await db.collectionMembershipMutations.put({
    libraryItemId: "lib-1",
    revision: "r",
    queuedAt: "",
    changes: [
      { collectionId: "col-1", member: true, baselineMember: true },
      { collectionId: "other", member: true, baselineMember: false },
    ],
  });
  await removeCollectionFromCache("col-1");
  expect(
    (await db.collectionMembershipMutations.get("lib-1"))?.changes,
  ).toEqual([{ collectionId: "other", member: true, baselineMember: false }]);
  expect((await readLibraryView())?.uncollectedBooks).toHaveLength(2);
  expect(
    await db.collectionMembership.where("collectionId").equals("col-1").count(),
  ).toBe(0);
});
