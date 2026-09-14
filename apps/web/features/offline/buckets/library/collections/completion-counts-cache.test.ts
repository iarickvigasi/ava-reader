import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { bumpCompletionRevision, readCompletionRevision, recordCompletionAck } from "../../../completion/state";
import { payload } from "../test-fixture";
import { applyCollectionPayload, applyLibraryPayload } from "./write-library";
import { readLibraryView } from "./read-library";
import { getLibrarySnapshot, subscribe, __resetLibraryBucketForTests } from "../bucket";

const date = "2026-09-14T12:00:00.000Z";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => { __resetLibraryBucketForTests(); __resetDbForTests(); });

function previewPayload() {
  const data = payload();
  data.summary.booksCount = 3;
  data.collections[0] = { ...data.collections[0], itemCount: 3, unreadCount: 1,
    books: data.collections[0].books.slice(0, 1),
    completionItems: [
      { libraryItemId: "lib-1", finishedAt: null, completionPercent: 10 },
      { libraryItemId: "outside-preview", finishedAt: date, completionPercent: 40 },
      { libraryItemId: "uncached-complete", finishedAt: null, completionPercent: 100 },
    ],
  };
  return data;
}

it("persists the full count snapshot independently of cached preview cards", async () => {
  const data = previewPayload();
  await applyLibraryPayload(data, { expectedCompletionRevision: 0 });
  const db = getDb();
  expect(await db.libraryItems.count()).toBe(1);
  expect((await db.collections.get("col-1"))?.completionItems).toEqual(data.collections[0].completionItems);
  expect((await readLibraryView())?.collections[0]).toMatchObject({ itemCount: 3, unreadCount: 1 });
  await db.finishDateMutations.put({ libraryItemId: "outside-preview", finishedAt: null,
    revision: "clear", queuedAt: date });
  expect((await readLibraryView())?.collections[0]).toMatchObject({ itemCount: 3, unreadCount: 2 });
  expect((await readLibraryView())?.summary.booksCount).toBe(3);
});

it("rejects stale library metadata and book dates when the aggregate revision changed", async () => {
  const db = getDb();
  const data = previewPayload();
  await applyLibraryPayload(data, { expectedCompletionRevision: 0 });
  const requestedRevision = await readCompletionRevision(db);
  await db.transaction("rw", db.meta, () => recordCompletionAck(db, "lib-1", { finishedAt: date }));
  const stale = previewPayload();
  stale.summary.booksCount = 999;
  stale.collections[0].name = "Stale name";
  stale.collections[0].books[0].finishedAt = null;
  await applyLibraryPayload(stale, { expectedCompletionRevision: requestedRevision });
  expect((await db.collections.get("col-1"))?.name).toBe(data.collections[0].name);
  expect((await db.collections.get("col-1"))?.completionRevision).toBe(0);
  expect((await readLibraryView())?.summary.booksCount).toBe(3);
  expect((await readLibraryView())?.collections[0]).toMatchObject({ itemCount: 3, unreadCount: 0 });
});

it("refreshes collection A without retiring an acknowledgment still needed by collection B", async () => {
  const db = getDb();
  const data = previewPayload();
  const a = data.collections[0];
  const b = { ...a, id: "col-2", slug: "second", name: "Second" };
  data.collections.push(b);
  data.summary.collectionsCount = 2;
  await applyLibraryPayload(data, { expectedCompletionRevision: 0 });
  const revision = await db.transaction("rw", db.meta, () => recordCompletionAck(db, "lib-1", { finishedAt: date }));
  const refreshed = { ...a, unreadCount: 0, books: [{ ...a.books[0], finishedAt: date }],
    completionItems: a.completionItems!.map((entry) => entry.libraryItemId === "lib-1" ? { ...entry, finishedAt: date } : entry) };
  await applyCollectionPayload(refreshed, false, db, { expectedCompletionRevision: revision });
  expect((await db.collections.get(a.id))?.completionRevision).toBe(revision);
  expect((await db.collections.get(b.id))?.completionRevision).toBe(0);
  expect((await readLibraryView())?.collections.map(({ unreadCount }) => unreadCount)).toEqual([0, 0]);
});

it("does not apply a stale single-collection count snapshot", async () => {
  const db = getDb();
  await applyLibraryPayload(previewPayload(), { expectedCompletionRevision: 0 });
  await db.transaction("rw", db.meta, () => bumpCompletionRevision(db));
  await applyCollectionPayload({ ...previewPayload().collections[0], completionItems: [], itemCount: 0, unreadCount: 0 },
    false, db, { expectedCompletionRevision: 0 });
  expect((await db.collections.get("col-1"))?.completionItems).toHaveLength(3);
  expect((await readLibraryView())?.collections[0]).toMatchObject({ itemCount: 3, unreadCount: 1 });
});

it("updates an already subscribed library screen when a finish date is saved or removed", async () => {
  await applyLibraryPayload(previewPayload(), { expectedCompletionRevision: 0 });
  const stop = subscribe(() => {});
  try {
    await vi.waitFor(() => expect(getLibrarySnapshot()?.collections[0].unreadCount).toBe(1));
    await getDb().finishDateMutations.put({ libraryItemId: "lib-1", finishedAt: date,
      revision: "save", queuedAt: date });
    await vi.waitFor(() => expect(getLibrarySnapshot()?.collections[0].unreadCount).toBe(0));
    await getDb().finishDateMutations.put({ libraryItemId: "lib-1", finishedAt: null,
      revision: "clear", queuedAt: date });
    await vi.waitFor(() => expect(getLibrarySnapshot()?.collections[0].unreadCount).toBe(1));
  } finally {
    stop();
  }
});
