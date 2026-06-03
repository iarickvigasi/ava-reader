import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { DB_NAME, __resetDbForTests } from "../../db";
import {
  applyCurrentUser,
  clearCurrentUser,
  readCurrentUser,
} from "./storage";

const user: CurrentUserPayload = {
  id: "user-1",
  clerkUserId: "clerk-1",
  email: "reader@example.com",
  displayName: "Ada Reader",
  avatarUrl: null,
  role: "USER",
};

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("me bucket storage", () => {
  it("returns null before any user is cached", async () => {
    expect(await readCurrentUser()).toBeNull();
  });

  it("round-trips the current user", async () => {
    await applyCurrentUser(user);
    expect(await readCurrentUser()).toEqual(user);
  });

  it("overwrites the single row on re-apply", async () => {
    await applyCurrentUser(user);
    await applyCurrentUser({ ...user, displayName: "Renamed", role: "ADMIN" });
    const round = await readCurrentUser();
    expect(round?.displayName).toBe("Renamed");
    expect(round?.role).toBe("ADMIN");
  });

  it("clears the cached user", async () => {
    await applyCurrentUser(user);
    await clearCurrentUser();
    expect(await readCurrentUser()).toBeNull();
  });
});
