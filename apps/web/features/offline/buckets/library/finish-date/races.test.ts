import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvaReaderDB, getDb, __resetDbForTests, type LibraryItemRow } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { readBookInfo, __resetLibraryBucketForTests } from "../bucket";
import { revalidateBookInfo } from "../revalidate";
import { setBookFinishedAt } from "./mutation";
import { clearFinishDateRuntime, finishDateGeneration } from "./runtime";
import { book, deferredResponse, finishedAt, seedFinishDateFixture, token } from "./test-fixture";

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

// A different tab changes the shared database without touching this tab's
// module-level generation counter or calling its mutation/sync functions.
async function acknowledgeInOtherTab(db: AvaReaderDB) {
  await db.transaction("rw!", [db.libraryItems, db.finishDateMutations, db.meta], async () => {
    await db.libraryItems.update(book.libraryItemId, { "details.finishedAt": finishedAt });
    await db.finishDateMutations.delete(book.libraryItemId);
    await db.meta.put({
      key: "finish-date-revision", value: crypto.randomUUID(), updatedAt: finishedAt,
    });
  });
}

it("does not overwrite another tab's acknowledged finish date with an older GET response", async () => {
  const response = deferredResponse();
  vi.stubGlobal("fetch", vi.fn(response.fetch));
  const otherTab = new AvaReaderDB(getDb().name);
  await otherTab.open();
  try {
    const generation = finishDateGeneration();
    const revalidating = revalidateBookInfo(book.slug, token);
    await response.started;
    await acknowledgeInOtherTab(otherTab);
    expect(finishDateGeneration()).toBe(generation);
    response.respond(Response.json({ book }));
    await revalidating;
    expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
  } finally {
    otherTab.close();
  }
});

it("reads a consistent finish date when another tab acknowledges between the book and queue reads", async () => {
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  const db = getDb();
  const otherTab = new AvaReaderDB(db.name);
  await otherTab.open();
  let acknowledgment: Promise<void> | undefined;
  const onRead = (row: LibraryItemRow) => {
    if (row.libraryItemId === book.libraryItemId && !acknowledgment) {
      acknowledgment = Dexie.ignoreTransaction(() => acknowledgeInOtherTab(otherTab));
    }
    return row;
  };
  db.libraryItems.hook("reading", onRead);
  try {
    // Both before and after acknowledgment the visible value is finishedAt.
    // Combining the old baseline with the now-empty queue would return null.
    expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
    expect(acknowledgment).toBeDefined();
    await acknowledgment;
    expect(await db.finishDateMutations.count()).toBe(0);
  } finally {
    db.libraryItems.hook("reading").unsubscribe(onRead);
    await acknowledgment;
    otherTab.close();
  }
});
