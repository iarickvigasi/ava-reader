import { acknowledgeDate } from "./completion-test-fixture";
import { liveQuery } from "dexie";
import { expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { token } from "../library/membership/test-fixture";
import { setBookFinishedAt } from "../library/finish-date/mutation";
import { readHome } from "./storage";
import { finishDate, trackedId } from "./test-fixture";

it("does not replace a home collection snapshot with the library's older counts for pending membership", async () => {
  await getDb().collectionMembershipMutations.put({
    libraryItemId: trackedId,
    revision: "remove",
    queuedAt: finishDate,
    changes: [
      { collectionId: "collection-1", baselineMember: true, member: false },
    ],
  });
  await setBookFinishedAt(trackedId, finishDate, token);
  expect((await readHome())?.collections.items[0]).toMatchObject({
    itemCount: 3,
    unreadCount: 1,
  });
  expect((await readHome())?.stats.volumesRead).toBe(4);
});

it("updates an existing live home reader after mark, acknowledgement, and clear", async () => {
  const counts: number[] = [];
  const subscription = liveQuery(readHome).subscribe((home) => {
    if (home) counts.push(home.stats.volumesRead);
  });
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
