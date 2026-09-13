import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvaReaderDB, getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { clearFinishDateFailure, readFinishDateFailures, writeFinishDateFailure } from "./failure-store";
import { clearFinishDateRuntime, subscribeToFinishDateSyncFailures } from "./runtime";

const event = { libraryItemId: "book-1", reason: "Forbidden", revision: "revision-1" };
const cleanups: Array<() => void> = [];

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});

afterEach(() => {
  clearFinishDateRuntime();
  for (const cleanup of cleanups.splice(0)) cleanup();
  __resetDbForTests();
});

it("delivers a failure written by another database connection and deduplicates its revision", async () => {
  const db = getDb();
  const otherTab = new AvaReaderDB(db.name);
  cleanups.push(() => otherTab.close());
  const listener = vi.fn();
  subscribeToFinishDateSyncFailures(listener);

  await writeFinishDateFailure(otherTab, event);
  await vi.waitFor(() => expect(listener).toHaveBeenCalledExactlyOnceWith({
    libraryItemId: event.libraryItemId, reason: event.reason,
  }));
  await writeFinishDateFailure(otherTab, event);
  await writeFinishDateFailure(otherTab, { ...event, libraryItemId: "book-2", revision: "revision-2" });
  await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
  await writeFinishDateFailure(otherTab, { ...event, revision: "revision-3" });
  await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(3));
});

it("replays unhandled failures after a cache reopen and stops replaying cleared failures", async () => {
  await writeFinishDateFailure(getDb(), event);
  clearFinishDateRuntime();
  __resetDbForTests();
  const listener = vi.fn();
  const unsubscribe = subscribeToFinishDateSyncFailures(listener);
  await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
  unsubscribe();
  await clearFinishDateFailure(getDb(), event.libraryItemId);
  expect(await readFinishDateFailures(getDb())).toEqual([]);

  const nextListener = vi.fn();
  subscribeToFinishDateSyncFailures(nextListener);
  await writeFinishDateFailure(getDb(), { ...event, libraryItemId: "book-2" });
  await vi.waitFor(() => expect(nextListener).toHaveBeenCalledExactlyOnceWith({
    libraryItemId: "book-2", reason: event.reason,
  }));
  expect(listener).toHaveBeenCalledTimes(1);
});

it("commits failure records atomically with the caller's queue transaction", async () => {
  const db = getDb();
  await db.finishDateMutations.put({ ...event, finishedAt: null, queuedAt: new Date().toISOString() });
  await expect(db.transaction("rw", [db.meta, db.finishDateMutations], async () => {
    await db.finishDateMutations.delete(event.libraryItemId);
    await writeFinishDateFailure(db, event);
    throw new Error("Transaction failed");
  })).rejects.toThrow("Transaction failed");
  expect(await db.finishDateMutations.count()).toBe(1);
  expect(await readFinishDateFailures(db)).toEqual([]);
});

it("does not deliver failures from a former account after switching databases", async () => {
  const oldDb = getDb();
  const otherOldTab = new AvaReaderDB(oldDb.name);
  cleanups.push(() => otherOldTab.close());
  const oldListener = vi.fn();
  subscribeToFinishDateSyncFailures(oldListener);
  await writeFinishDateFailure(otherOldTab, event);
  await vi.waitFor(() => expect(oldListener).toHaveBeenCalledTimes(1));

  setActiveUser("finish-date-failure-other-user");
  const db = getDb();
  await db.delete();
  await db.open();
  const newListener = vi.fn();
  subscribeToFinishDateSyncFailures(newListener);
  await writeFinishDateFailure(otherOldTab, { ...event, revision: "old-account-revision" });
  await writeFinishDateFailure(db, { ...event, reason: "New account failure", revision: "new-account-revision" });
  await vi.waitFor(() => expect(newListener).toHaveBeenCalledExactlyOnceWith({
    libraryItemId: event.libraryItemId, reason: "New account failure",
  }));
  expect(oldListener).toHaveBeenCalledTimes(1);
  clearFinishDateRuntime();
  await db.delete();
});

it("ignores unrelated or malformed metadata and cancels listeners on runtime clear", async () => {
  const db = getDb();
  await db.meta.bulkPut([
    { key: "unrelated-private-metadata", value: event, updatedAt: "now" },
    { key: "finish-date-failure:book-2", value: event, updatedAt: "now" },
    { key: "finish-date-failure:book-3", value: { libraryItemId: "book-3" }, updatedAt: "now" },
  ]);
  expect(await readFinishDateFailures(db)).toEqual([]);
  const listener = vi.fn();
  subscribeToFinishDateSyncFailures(listener);
  clearFinishDateRuntime();
  await writeFinishDateFailure(db, event);
  expect(await readFinishDateFailures(db)).toEqual([event]);
  expect(listener).not.toHaveBeenCalled();
});
