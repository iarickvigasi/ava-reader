import "fake-indexeddb/auto";
import { liveQuery } from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { readCompletionRevision, recordCompletionAck } from "../../completion/state";
import { __resetNetStateForTests, __setNetStateForTests } from "../../net/net-state";
import { readVolumesReadDelta } from "../../stats/local-deltas";
import { hydrateBookInfo, __resetLibraryBucketForTests } from "../library/bucket";
import { book, token } from "../library/membership/test-fixture";
import { setBookFinishedAt } from "../library/finish-date/mutation";
import { clearFinishDateRuntime } from "../library/finish-date/runtime";
import { writeProgress } from "../progress/storage";
import { applyHome, readHome } from "./storage";
import { completion, finishDate, homeFixture, trackedId } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await hydrateBookInfo({ ...book, completionPercent: 40 });
  await applyHome(homeFixture(), { expectedCompletionRevision: await readCompletionRevision(getDb()) });
});
afterEach(() => {
  clearFinishDateRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

async function acknowledgeDate(finishedAt: string | null) {
  const db = getDb();
  await db.transaction("rw", [db.libraryItems, db.finishDateMutations, db.meta], async () => {
    await recordCompletionAck(db, trackedId, { finishedAt });
    await db.libraryItems.update(trackedId, { finishedAt, "details.finishedAt": finishedAt });
    await db.finishDateMutations.delete(trackedId);
  });
}

it("preserves uncached and archived completions while a cached book is marked and acknowledged", async () => {
  expect(await getDb().libraryItems.count()).toBe(1);
  expect((await readHome())?.stats.volumesRead).toBe(3);
  await setBookFinishedAt(trackedId, finishDate, token);
  const marked = await readHome();
  expect(marked?.stats.volumesRead).toBe(4);
  expect(marked?.collections.items[0]).toMatchObject({ itemCount: 4, unreadCount: 1 });
  expect(await readVolumesReadDelta()).toBe(1);
  await acknowledgeDate(finishDate);
  expect(await getDb().finishDateMutations.count()).toBe(0);
  clearFinishDateRuntime();
  __resetDbForTests();
  expect((await readHome())?.stats.volumesRead).toBe(4);
  expect((await readHome())?.collections.items[0].unreadCount).toBe(1);
  // Composition never writes an effective count back as the server baseline.
  expect((await getDb().home.get("me"))?.payload).toEqual(homeFixture());
});

it("keeps a home adjustment until its own newer snapshot arrives", async () => {
  await setBookFinishedAt(trackedId, finishDate, token);
  await acknowledgeDate(finishDate);
  await applyHome(homeFixture(), { seedOnly: true });
  expect((await readHome())?.stats.volumesRead).toBe(4);
  const fresh = homeFixture();
  fresh.completionItems![0] = completion(trackedId, 40, finishDate);
  fresh.collections.items[0].completionItems![0] = completion(trackedId, 40, finishDate);
  fresh.stats.volumesRead = 4;
  fresh.collections.items[0].unreadCount = 1;
  await applyHome(fresh, { expectedCompletionRevision: await readCompletionRevision(getDb()) });
  expect((await readHome())?.stats.volumesRead).toBe(4);
  expect(await readVolumesReadDelta()).toBe(0);
});

it("counts date and 100% once, and removing the date leaves 100% completed", async () => {
  await setBookFinishedAt(trackedId, finishDate, token);
  await writeProgress({
    libraryItemId: trackedId, completionPercent: 100, dirty: true,
    locator: { chapterId: "last", blockId: "last", textOffset: 0 },
  });
  expect((await readHome())?.stats.volumesRead).toBe(4);
  await setBookFinishedAt(trackedId, null, token);
  expect((await readHome())?.stats.volumesRead).toBe(4);
  expect((await readHome())?.collections.items[0].unreadCount).toBe(1);
  await writeProgress({
    libraryItemId: trackedId, completionPercent: 70, dirty: true,
    locator: { chapterId: "middle", blockId: "middle", textOffset: 0 },
  });
  expect((await readHome())?.stats.volumesRead).toBe(3);
  expect((await readHome())?.collections.items[0].unreadCount).toBe(2);
});

it("does not replace a home collection snapshot with the library's older counts for pending membership", async () => {
  await getDb().collectionMembershipMutations.put({
    libraryItemId: trackedId, revision: "remove", queuedAt: finishDate,
    changes: [{ collectionId: "collection-1", baselineMember: true, member: false }],
  });
  await setBookFinishedAt(trackedId, finishDate, token);
  expect((await readHome())?.collections.items[0]).toMatchObject({ itemCount: 3, unreadCount: 1 });
  expect((await readHome())?.stats.volumesRead).toBe(4);
});

it("updates an existing live home reader after mark, acknowledgement, and clear", async () => {
  const counts: number[] = [];
  const subscription = liveQuery(readHome).subscribe((home) => { if (home) counts.push(home.stats.volumesRead); });
  try {
    await vi.waitFor(() => expect(counts.at(-1)).toBe(3));
    await setBookFinishedAt(trackedId, finishDate, token);
    await vi.waitFor(() => expect(counts.at(-1)).toBe(4));
    await acknowledgeDate(finishDate);
    await setBookFinishedAt(trackedId, null, token);
    await vi.waitFor(() => expect(counts.at(-1)).toBe(3));
  } finally {
    subscription.unsubscribe();
  }
});
