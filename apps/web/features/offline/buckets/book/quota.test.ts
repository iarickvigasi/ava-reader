import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_QUOTA_FLOOR_BYTES, checkStorageQuota } from "./quota";

const realNavigator = globalThis.navigator;

afterEach(() => {
  // Restore whatever `navigator` looked like before each test, since we
  // may have stubbed `navigator.storage` to exercise the probe.
  if (realNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: realNavigator,
      configurable: true,
    });
  }
});

function stubNavigator(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: storage ? { storage } : {},
    configurable: true,
  });
}

describe("checkStorageQuota", () => {
  it("returns ok when navigator.storage is unavailable", async () => {
    stubNavigator(undefined);
    const result = await checkStorageQuota();
    expect(result.ok).toBe(true);
  });

  it("returns ok with null free bytes when quota is 0 (unknown)", async () => {
    stubNavigator({
      estimate: async () => ({ quota: 0, usage: 0 }),
    });
    const result = await checkStorageQuota();
    expect(result).toEqual({ ok: true, freeBytes: null });
  });

  it("returns ok when free space comfortably exceeds the floor", async () => {
    stubNavigator({
      estimate: async () => ({
        quota: 1024 * 1024 * 1024, // 1 GB
        usage: 200 * 1024 * 1024, // 200 MB
      }),
    });
    const result = await checkStorageQuota();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.freeBytes).toBe(824 * 1024 * 1024);
    }
  });

  it("returns NOT ok when free space falls below the floor", async () => {
    stubNavigator({
      estimate: async () => ({
        quota: 200 * 1024 * 1024,
        usage: 150 * 1024 * 1024,
      }),
    });
    const result = await checkStorageQuota();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.freeBytes).toBe(50 * 1024 * 1024);
      expect(result.freeBytes).toBeLessThan(DEFAULT_QUOTA_FLOOR_BYTES);
    }
  });

  it("respects a custom floor argument", async () => {
    stubNavigator({
      estimate: async () => ({
        quota: 200 * 1024 * 1024,
        usage: 150 * 1024 * 1024,
      }),
    });
    // 10 MB floor — 50 MB free comfortably exceeds it.
    const result = await checkStorageQuota(10 * 1024 * 1024);
    expect(result.ok).toBe(true);
  });

  it("recovers when estimate() throws", async () => {
    stubNavigator({
      estimate: async () => {
        throw new Error("blocked");
      },
    });
    const result = await checkStorageQuota();
    expect(result).toEqual({ ok: true, freeBytes: null });
  });

  // Silence the noisy globalThis ref for typecheck.
  void vi;
});
