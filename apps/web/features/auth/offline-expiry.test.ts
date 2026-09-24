import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import {
  getDb,
  getActiveUserId,
  setActiveUser,
  __resetDbForTests,
} from "@/features/offline/db";
import { selectDeviceOwner } from "./select-device-owner";
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});
it("preserves cached identity and pending annotations through expiry and same-account return", async () => {
  setActiveUser("remembered-reader");
  const pending = {
    mutationId: "mutation",
    kind: "upsert" as const,
    scopeId: "book",
    payload: {
      excerpt: "Saved offline",
      highlightColor: "sand",
      locator: null,
    },
    highlightId: "highlight",
    queuedAt: "2026-09-24T00:00:00Z",
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
  };
  await getDb().highlightMutations.put(pending);
  await selectDeviceOwner(null);
  expect(getActiveUserId()).toBe("remembered-reader");
  expect(await getDb().highlightMutations.get("mutation")).toEqual(pending);
  await selectDeviceOwner("remembered-reader");
  expect(await getDb().highlightMutations.get("mutation")).toEqual(pending);
});
