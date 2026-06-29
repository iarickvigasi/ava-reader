import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetDbForTests,
  ACTIVE_USER_STORAGE_KEY,
  clearActiveUser,
  dbNameForUser,
  deleteUserDb,
  getActiveUserId,
  getDb,
  purgeOtherUserDbs,
  setActiveUser,
} from "./db";

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

beforeEach(async () => {
  __resetDbForTests();
  await deleteAllOfflineDbs();
});

afterEach(async () => {
  __resetDbForTests();
  await deleteAllOfflineDbs();
});

describe("per-user database", () => {
  it("opens ava-reader-<userId> for the active user", () => {
    setActiveUser("user-1");
    expect(dbNameForUser("user-1")).toBe("ava-reader-user-1");
    expect(getDb().name).toBe("ava-reader-user-1");
  });

  it("tracks the active user, defaulting to null", () => {
    expect(getActiveUserId()).toBeNull();
    setActiveUser("user-1");
    expect(getActiveUserId()).toBe("user-1");
  });

  it("isolates data between users on the same profile", async () => {
    setActiveUser("user-1");
    await getDb().me.put({ id: "me", user: anyUser(), fetchedAt: "t" });
    expect(await getDb().me.count()).toBe(1);

    // Switching users opens a different, empty database.
    setActiveUser("user-2");
    expect(await getDb().me.count()).toBe(0);

    // Switching back finds user-1's data intact.
    setActiveUser("user-1");
    expect(await getDb().me.count()).toBe(1);
  });
});

describe("deleteUserDb / purgeOtherUserDbs", () => {
  it("deleteUserDb removes only that user's database", async () => {
    setActiveUser("user-1");
    await getDb().me.put({ id: "me", user: anyUser(), fetchedAt: "t" });
    setActiveUser("user-2");
    await getDb().me.put({ id: "me", user: anyUser(), fetchedAt: "t" });

    await deleteUserDb("user-1");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(dbNameForUser("user-1"));
    expect(names).toContain(dbNameForUser("user-2"));
  });

  it("purgeOtherUserDbs keeps only the named user's database", async () => {
    for (const u of ["user-1", "user-2", "user-3"]) {
      setActiveUser(u);
      await getDb().me.put({ id: "me", user: anyUser(), fetchedAt: "t" });
    }

    await purgeOtherUserDbs("user-2");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain(dbNameForUser("user-2"));
    expect(names).not.toContain(dbNameForUser("user-1"));
    expect(names).not.toContain(dbNameForUser("user-3"));
  });
});

describe("active-user persistence (pre-boot offline read)", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the active user and recovers it after a cold boot", () => {
    setActiveUser("user-x");
    expect(store.get(ACTIVE_USER_STORAGE_KEY)).toBe("user-x");

    // Simulate a fresh page load: the module forgets its in-memory value, so
    // getActiveUserId must recover it from localStorage (the instant offline
    // read before Clerk boots).
    __resetDbForTests();
    expect(getActiveUserId()).toBe("user-x");
    expect(getDb().name).toBe(dbNameForUser("user-x"));
  });

  it("clearActiveUser removes the persisted marker", () => {
    setActiveUser("user-x");
    clearActiveUser();
    expect(store.get(ACTIVE_USER_STORAGE_KEY)).toBeUndefined();
    expect(getActiveUserId()).toBeNull();
  });
});
