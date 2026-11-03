import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import {
  readCompletionRevision,
  recordCompletionAck,
} from "../../completion/state";
import {
  __resetNetStateForTests,
  __setNetStateForTests,
} from "../../net/net-state";
import {
  hydrateBookInfo,
  __resetLibraryBucketForTests,
} from "../library/bucket";
import { book } from "../library/membership/test-fixture";
import { clearFinishDateRuntime } from "../library/finish-date/runtime";
import { applyHome } from "./storage";
import { homeFixture, trackedId } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await hydrateBookInfo({ ...book, completionPercent: 40 });
  await applyHome(homeFixture(), {
    expectedCompletionRevision: await readCompletionRevision(getDb()),
  });
});
afterEach(() => {
  clearFinishDateRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

export async function acknowledgeDate(finishedAt: string | null) {
  const db = getDb();
  await db.transaction(
    "rw",
    [db.libraryItems, db.finishDateMutations, db.meta],
    async () => {
      await recordCompletionAck(db, trackedId, { finishedAt });
      await db.libraryItems.update(trackedId, {
        finishedAt,
        "details.finishedAt": finishedAt,
      });
      await db.finishDateMutations.delete(trackedId);
    },
  );
}
