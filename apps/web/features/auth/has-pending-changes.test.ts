import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "@/features/offline/db";
import { hasPendingChanges } from "./has-pending-changes";
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
