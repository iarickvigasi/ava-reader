import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DB_NAME, __resetDbForTests, getDb } from "../../../db";
import {
  __resetLibraryBucketForTests,
  refreshFromDb,
  getLibrarySnapshot,
} from "../bucket";
import { payload } from "../test-fixture";
import { applyLibraryPayload } from "./write-library";
import { readLibraryView } from "./read-library";

beforeEach(async () => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
  await applyLibraryPayload({
    books: payload().collections[0].books.map((book) => ({
      ...book,
      source: "CATALOG",
      hasReadableEdition: true,
    })),
    collections: [],
    summary: { booksCount: 2, collectionsCount: 0 },
  });
});
afterEach(() => {
  __resetLibraryBucketForTests();
  __resetDbForTests();
});
it("requires readable cached content rather than download intent and reacts to eviction", async () => {
  const db = getDb();
  await db.libraryItems.update("lib-1", { offlineRequested: true });
  expect(
    (await readLibraryView())?.books.every((book) => !book.availableOffline),
  ).toBe(true);
  await db.books.put({
    libraryItemId: "lib-1",
    chapterIds: ["c"],
    toc: [],
    metadata: {},
    fetchedAt: "now",
  });
  expect(
    (await readLibraryView())?.books.find(
      (book) => book.libraryItemId === "lib-1",
    )?.availableOffline,
  ).toBe(false);
  await db.bookChapters.put({
    libraryItemId: "lib-1",
    chapterId: "c",
    index: 0,
    blocks: [],
    aux: null,
    fetchedAt: "now",
  });
  await refreshFromDb();
  const downloaded = getLibrarySnapshot();
  expect(
    downloaded?.books.find((book) => book.libraryItemId === "lib-1")
      ?.availableOffline,
  ).toBe(true);
  await db.books.delete("lib-1");
  await refreshFromDb();
  expect(getLibrarySnapshot()).not.toBe(downloaded);
  expect(
    getLibrarySnapshot()?.books.find((book) => book.libraryItemId === "lib-1")
      ?.availableOffline,
  ).toBe(false);
});
it("overlays pending finish dates without altering percentage or requiring a collection", async () => {
  await refreshFromDb();
  await getDb().finishDateMutations.put({
    libraryItemId: "lib-2",
    revision: "r",
    queuedAt: "now",
    finishedAt: "2026-10-25",
  });
  await refreshFromDb();
  expect(
    getLibrarySnapshot()?.books.find((book) => book.libraryItemId === "lib-2"),
  ).toMatchObject({
    finishedAt: "2026-10-25",
    completionPercent: 0,
    source: "CATALOG",
    hasReadableEdition: true,
  });
  await getDb().finishDateMutations.put({
    libraryItemId: "lib-2",
    revision: "r2",
    queuedAt: "now",
    finishedAt: null,
  });
  expect(
    (await readLibraryView())?.books.find(
      (book) => book.libraryItemId === "lib-2",
    )?.finishedAt,
  ).toBeNull();
});
