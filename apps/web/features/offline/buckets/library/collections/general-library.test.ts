import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
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
const ids = async () =>
  (await readLibraryView())?.uncollectedBooks?.map(
    (book) => book.libraryItemId,
  );
const books = () => payload().collections[0].books;

it("persists a collection-free catalog, including more than four books", async () => {
  const catalog = Array.from({ length: 9 }, (_, i) => ({
    ...books()[0],
    libraryItemId: `item-${i}`,
    slug: `item-${i}`,
  }));
  await applyLibraryPayload({
    books: catalog,
    collections: [],
    summary: { booksCount: 9, collectionsCount: 0 },
  });
  __resetLibraryBucketForTests();
  expect(await ids()).toHaveLength(9);
  expect((await readLibraryView())?.collections).toEqual([]);
});

it("distinguishes a hydrated empty Library from a never-loaded cache", async () => {
  expect(await readLibraryView()).toBeNull();
  await applyLibraryPayload({
    books: [],
    collections: [],
    summary: { booksCount: 0, collectionsCount: 0 },
  });
  expect(await readLibraryView()).toMatchObject({
    books: [],
    uncollectedBooks: [],
    collections: [],
  });
});
