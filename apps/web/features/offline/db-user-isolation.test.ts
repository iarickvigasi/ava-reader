import { describe, expect, it } from "vitest";
import { anyUser } from "./db-user-test-fixture";
import {
  dbNameForUser,
  deleteUserDb,
  getActiveUserId,
  getDb,
  purgeOtherUserDbs,
  setActiveUser,
} from "./db";

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
    await getDb().me.put({
      id: "me",
      user: anyUser(),
      avatarBlob: null,
      fetchedAt: "t",
    });
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
    await getDb().me.put({
      id: "me",
      user: anyUser(),
      avatarBlob: null,
      fetchedAt: "t",
    });
    setActiveUser("user-2");
    await getDb().me.put({
      id: "me",
      user: anyUser(),
      avatarBlob: null,
      fetchedAt: "t",
    });

    await deleteUserDb("user-1");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain(dbNameForUser("user-1"));
    expect(names).toContain(dbNameForUser("user-2"));
  });

  it("purgeOtherUserDbs keeps only the named user's database", async () => {
    for (const u of ["user-1", "user-2", "user-3"]) {
      setActiveUser(u);
      await getDb().me.put({
        id: "me",
        user: anyUser(),
        avatarBlob: null,
        fetchedAt: "t",
      });
    }

    await purgeOtherUserDbs("user-2");

    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain(dbNameForUser("user-2"));
    expect(names).not.toContain(dbNameForUser("user-1"));
    expect(names).not.toContain(dbNameForUser("user-3"));
  });
});
