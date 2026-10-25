import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, SCHEMA_VERSION, __resetDbForTests, getDb } from "../db";
import { __resetLibraryBucketForTests } from "../buckets/library/bucket";
import { readLibraryView } from "../buckets/library/collections/read-library";
import { seedRetiredCollections } from "./retired-collections-fixture";

beforeEach(async () => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
});
afterEach(async () => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
});

it("deletes retired shelves before offline reads, preserving custom namesakes, content, and pending edits", async () => {
  const { old, custom, before, beforeItems } = await seedRetiredCollections();
  old.close();
  const db = getDb();
  await db.open();
  expect(db.verno).toBe(SCHEMA_VERSION);
  expect(await db.collections.toArray()).toEqual(
    [...custom].sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(await db.collectionMembership.toArray()).toEqual([
    { collectionId: custom[0].id, libraryItemId: "lib-1", order: 0 },
  ]);
  for (const [table, rows] of Object.entries(before))
    expect(await db.table(table).toArray()).toEqual(rows);
  const items = await db.libraryItems.toArray();
  expect(items).toEqual(
    beforeItems.map((row) =>
      row.details
        ? {
            ...row,
            details: {
              ...row.details,
              collections: custom,
            },
          }
        : row,
    ),
  );
  expect((await db.home.get("me"))?.payload.collections.items).toEqual(custom);
  const view = await readLibraryView();
  expect(view?.uncollectedBooks?.map((row) => row.libraryItemId)).toEqual([
    "lib-2",
  ]);
  expect(view?.summary.booksCount).toBe(2);
  __resetDbForTests();
  expect(await getDb().collections.count()).toBe(3);
});

it("preserves books from a collection-only legacy cache without a stored Library summary", async () => {
  const { old } = await seedRetiredCollections();
  await old.table("collections").where("kind").equals("CUSTOM").delete();
  await old.table("meta").delete("library:booksCount");
  old.close();
  const view = await readLibraryView();
  expect(view?.collections).toEqual([]);
  expect(view?.uncollectedBooks).toHaveLength(2);
});

it("deletes stale membership links found only in cached Home or book-info references", async () => {
  const { old, custom } = await seedRetiredCollections();
  await old.table("collections").where("kind").equals("SMART").delete();
  old.close();
  const db = getDb();
  await db.open();
  expect(await db.collectionMembership.count()).toBe(1);
  expect((await db.home.get("me"))?.payload.collections.items).toEqual(custom);
});
