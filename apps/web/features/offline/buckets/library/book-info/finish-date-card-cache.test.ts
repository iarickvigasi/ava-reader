import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { book } from "../membership/test-fixture";
import { payload } from "../test-fixture";
import { applyCollectionPayload, applyLibraryPayload } from "../collections/write-library";
import { applyBookInfoPayload } from "./write-book-info";
import { readBookInfoBySlug } from "./read-book-info";

const date = "2026-09-14T12:00:00.000Z";
const oldDate = "2026-09-01T12:00:00.000Z";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => __resetDbForTests());

function libraryPayload(finishedAt: string | null) {
  const data = payload();
  data.collections[0].books[0].finishedAt = finishedAt;
  return data;
}

it.each([date, null])("writes book-info finish date %s to the canonical card row and details", async (finishedAt) => {
  await applyBookInfoPayload({ ...book, finishedAt });
  const row = await getDb().libraryItems.get(book.libraryItemId);
  expect(row?.finishedAt).toBe(finishedAt);
  expect(row?.details?.finishedAt).toBe(finishedAt);
});

it.each([date, null])("reflects a fresh library date %s in cached book info", async (finishedAt) => {
  await applyBookInfoPayload({ ...book, finishedAt: oldDate });
  await applyLibraryPayload(libraryPayload(finishedAt));
  expect((await readBookInfoBySlug(book.slug))?.finishedAt).toBe(finishedAt);
  expect((await getDb().libraryItems.get(book.libraryItemId))?.details?.finishedAt).toBe(finishedAt);
});

it.each([date, null])("keeps pending finish date %s over a fresh collection canonical date", async (finishedAt) => {
  const canonical = finishedAt === null ? date : null;
  await applyBookInfoPayload({ ...book, finishedAt: oldDate });
  await getDb().finishDateMutations.put({
    libraryItemId: book.libraryItemId, finishedAt, revision: "pending-revision", queuedAt: date,
  });
  await applyCollectionPayload(libraryPayload(canonical).collections[0]);
  expect((await readBookInfoBySlug(book.slug))?.finishedAt).toBe(finishedAt);
  const row = await getDb().libraryItems.get(book.libraryItemId);
  expect(row?.finishedAt).toBe(canonical);
  expect(row?.details?.finishedAt).toBe(canonical);

  // Rehydrating the displayed local value must retain the newer baseline
  // needed if the pending edit is rejected by the server.
  await applyBookInfoPayload({ ...book, finishedAt });
  expect((await getDb().libraryItems.get(book.libraryItemId))?.finishedAt).toBe(canonical);
  expect((await readBookInfoBySlug(book.slug))?.finishedAt).toBe(finishedAt);
});

it("falls back to a legacy details date only when the canonical card date is absent", async () => {
  await applyBookInfoPayload({ ...book, finishedAt: date });
  const db = getDb();
  const row = (await db.libraryItems.get(book.libraryItemId))!;
  Reflect.deleteProperty(row, "finishedAt");
  await db.libraryItems.put(row);
  expect((await readBookInfoBySlug(book.slug))?.finishedAt).toBe(date);
  await db.libraryItems.update(book.libraryItemId, { finishedAt: null });
  expect((await readBookInfoBySlug(book.slug))?.finishedAt).toBeNull();
});
