import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { hydrateBookInfo, hydrateFromPayload, readBookInfo, __resetLibraryBucketForTests } from "../bucket";
import { applyCollectionPayload } from "../collections/write-library";
import { pruneLibraryItems } from "../prune-items";
import { payload } from "../test-fixture";
import { setBookFinishedAt } from "./mutation";
import { clearFinishDateRuntime } from "./runtime";
import { book, finishedAt, priorFinishedAt, readingState, seedFinishDateFixture, token } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedFinishDateFixture();
});
afterEach(() => {
  clearFinishDateRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

it("saves and clears offline across cache reopen without changing reading progress or time", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const before = await readingState();
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  clearFinishDateRuntime();
  __resetDbForTests();
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
  expect(await getDb().finishDateMutations.count()).toBe(1);
  expect(await readingState()).toEqual(before);

  await setBookFinishedAt(book.libraryItemId, null, token);
  clearFinishDateRuntime();
  __resetDbForTests();
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  expect((await getDb().finishDateMutations.get(book.libraryItemId))?.finishedAt).toBeNull();
  expect(await readingState()).toEqual(before);
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([finishedAt, null])("keeps the pending value %s through book, collection, and library hydration", async (pending) => {
  const baseline = pending === null ? priorFinishedAt : null;
  await hydrateBookInfo({ ...book, finishedAt: baseline });
  await setBookFinishedAt(book.libraryItemId, pending, token);
  await hydrateBookInfo({ ...book, finishedAt: baseline });
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(pending);
  await applyCollectionPayload(payload().collections[0]);
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(pending);
  await hydrateFromPayload(payload());
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(pending);
  expect(await getDb().finishDateMutations.count()).toBe(1);
});

it("reads old cached details with no finish date as null, even at 100% progress", async () => {
  const row = await getDb().libraryItems.get(book.libraryItemId);
  const legacyDetails = { ...row!.details! };
  Reflect.deleteProperty(legacyDetails, "finishedAt");
  await getDb().libraryItems.update(book.libraryItemId, {
    completionPercent: 100,
    details: legacyDetails,
  });
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  expect(await getDb().finishDateMutations.count()).toBe(0);
});

it("seeds missing book details but does not overwrite a finish date with a stale loader payload", async () => {
  await getDb().libraryItems.delete(book.libraryItemId);
  await hydrateBookInfo(book, { seedOnly: true });
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  await hydrateBookInfo({ ...book, finishedAt });
  await hydrateBookInfo(book, { seedOnly: true });
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
});

it.each([finishedAt, null])("preserves a book with pending finish date %s when a completed cache pass prunes absent items", async (pending) => {
  await setBookFinishedAt(book.libraryItemId, pending, token);
  await pruneLibraryItems([]);
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(pending);
  expect(await getDb().finishDateMutations.count()).toBe(1);
  expect(await getDb().libraryItems.get("lib-2")).toBeUndefined();
});
