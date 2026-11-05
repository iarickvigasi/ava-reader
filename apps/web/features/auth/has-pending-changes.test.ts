import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "@/features/offline/db";
import { hasPendingChanges } from "./has-pending-changes";
import { readingSession } from "@/features/offline/buckets/home/reading-test-fixture";
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});
it("warns for dirty preferences even without a legacy mutation row", async () => {
  expect(await hasPendingChanges()).toBe(false);
  await getDb().preferences.put({
    id: "me",
    values: { dailyGoalMinutes: 45 },
    dirtyFields: ["dailyGoalMinutes"],
    serverUpdatedAt: null,
  });
  expect(await hasPendingChanges()).toBe(true);
});

it("keeps newer reading pending after an earlier checkpoint was acknowledged", async () => {
  await getDb().sessions.put({
    ...readingSession,
    trackingVersion: 2,
    revision: 3,
    acknowledgedRevision: 2,
  });
  expect(await hasPendingChanges()).toBe(true);
  await getDb().sessions.update(readingSession.clientSessionId, {
    acknowledgedRevision: 3,
  });
  expect(await hasPendingChanges()).toBe(false);
});
