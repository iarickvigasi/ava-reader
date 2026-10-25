import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests, getDb } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { removeCollectionFromCache } from "../remove-collection";
import { payload } from "../test-fixture";
import { applyCollectionPayload, applyLibraryPayload } from "./write-library";
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
const ids = async () =>
  (await readLibraryView())?.uncollectedBooks?.map(
    (book) => book.libraryItemId,
  );
const books = () => payload().collections[0].books;

it("moves books immediately for pending first and last memberships, preserving other collections", async () => {
  const base = payload();
  const collection = {
    ...base.collections[0],
    books: [],
    itemCount: 0,
    unreadCount: 0,
    completionItems: [],
  };
  await applyLibraryPayload({
    ...base,
    books: books(),
    collections: [collection],
  });
  expect(await ids()).toHaveLength(2);
  const db = getDb();
  await db.collectionMembershipMutations.put({
    libraryItemId: "lib-1",
    revision: "r1",
    queuedAt: "",
    changes: [{ collectionId: "col-1", member: true, baselineMember: false }],
  });
  expect(await ids()).toEqual(["lib-2"]);
  __resetLibraryBucketForTests();
  expect(await ids()).toEqual(["lib-2"]);
  await applyCollectionPayload(
    {
      ...collection,
      books: [books()[0]],
      itemCount: 1,
      unreadCount: 1,
      completionItems: [
        { libraryItemId: "lib-1", finishedAt: null, completionPercent: 0 },
      ],
    },
    true,
  );
  await db.collectionMembershipMutations.delete("lib-1");
  expect(await ids()).toEqual(["lib-2"]);
  await db.collectionMembershipMutations.put({
    libraryItemId: "lib-1",
    revision: "r2",
    queuedAt: "",
    changes: [{ collectionId: "col-1", member: false, baselineMember: true }],
  });
  expect(await ids()).toHaveLength(2);
});

it("uses complete memberships beyond previews and returns books after the last collection is deleted", async () => {
  const base = payload();
  const collection = {
    ...base.collections[0],
    books: [books()[0]],
    completionItems: books().map((book) => ({
      libraryItemId: book.libraryItemId,
      finishedAt: null,
      completionPercent: 0,
    })),
  };
  await applyLibraryPayload({
    ...base,
    books: books(),
    collections: [collection, { ...collection, id: "other", slug: "other" }],
  });
  expect(await ids()).toEqual([]);
  await removeCollectionFromCache("col-1");
  expect(await ids()).toEqual([]);
  await removeCollectionFromCache("other");
  expect(await ids()).toHaveLength(2);
});
