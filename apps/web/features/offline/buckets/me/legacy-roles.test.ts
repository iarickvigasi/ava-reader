import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { getDb, __resetDbForTests } from "../../db";
import { applyCurrentUser, readCurrentUser } from "./storage";

const legacy = {
  id: "user",
  clerkUserId: "clerk",
  displayName: "Ada",
  email: "a@example.test",
  avatarUrl: null,
  role: "ADMIN",
};
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});
it("reads the old scalar format from IndexedDB and replaces it on refresh", async () => {
  await getDb().me.put({
    id: "me",
    user: legacy as unknown as CurrentUserPayload,
    avatarBlob: null,
    fetchedAt: new Date().toISOString(),
  });
  expect((await readCurrentUser())?.roles).toEqual(["ADMIN"]);
  await applyCurrentUser({ ...legacy, roles: [] });
  expect((await readCurrentUser())?.roles).toEqual([]);
  expect(await readCurrentUser()).not.toHaveProperty("role");
});
