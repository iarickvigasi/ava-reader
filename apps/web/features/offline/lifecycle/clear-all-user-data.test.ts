import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDbForTests,
  dbNameForUser,
  getActiveUserId,
  getDb,
  setActiveUser,
} from "../db";
import { adoptUser, wipeUserData } from "./clear-all-user-data";

const anyUser = () => ({
  id: "u",
  clerkUserId: "c",
  email: "x@y.z",
  displayName: "X",
  avatarUrl: null,
  role: "USER" as const,
});

async function deleteAllOfflineDbs() {
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs
      .map((d) => d.name)
      .filter((n): n is string => Boolean(n))
      .map(
        (n) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(n);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          }),
      ),
  );
}

async function seedUser(userId: string) {
  setActiveUser(userId);
  await getDb().me.put({ id: "me", user: anyUser(), fetchedAt: "t" });
}

beforeEach(async () => {
  __resetDbForTests();
  await deleteAllOfflineDbs();
});

afterEach(async () => {
  __resetDbForTests();
  await deleteAllOfflineDbs();
});

describe("wipeUserData (sign-out)", () => {
  it("deletes the user's database and forgets the active user", async () => {
    await seedUser("user-a");

    await wipeUserData("user-a");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(dbNameForUser("user-a"));
    expect(getActiveUserId()).toBeNull();
  });
});

describe("adoptUser (account switch / cold start)", () => {
  it("keeps the adopted user's DB, purges the others, and sets it active", async () => {
    await seedUser("user-a");
    await seedUser("user-b");

    await adoptUser("user-b");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain(dbNameForUser("user-b"));
    expect(names).not.toContain(dbNameForUser("user-a"));
    expect(getActiveUserId()).toBe("user-b");
    // The adopted user's data survives.
    expect(await getDb().me.count()).toBe(1);
  });
});
