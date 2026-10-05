import "./db-user-test-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetDbForTests,
  ACTIVE_USER_STORAGE_KEY,
  clearActiveUser,
  dbNameForUser,
  getActiveUserId,
  getDb,
  setActiveUser,
} from "./db";

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
