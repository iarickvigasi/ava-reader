import { afterEach, describe, expect, it } from "vitest";

import { formatBytes, readStorageInfo } from "./storage-info";

const realNavigator = globalThis.navigator;

afterEach(() => {
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

describe("readStorageInfo", () => {
  it("returns the empty shape when navigator.storage is unavailable", async () => {
    stubNavigator(undefined);
    const info = await readStorageInfo();
    expect(info.quotaBytes).toBeNull();
    expect(info.usageBytes).toBeNull();
    expect(info.freeBytes).toBeNull();
    expect(info.usageFraction).toBeNull();
  });

  it("returns quota / usage / free / fraction when the API works", async () => {
    stubNavigator({
      estimate: async () => ({
        quota: 1_000_000_000, // 1 GB
        usage: 250_000_000, // 250 MB
      }),
    });
    const info = await readStorageInfo();
    expect(info.quotaBytes).toBe(1_000_000_000);
    expect(info.usageBytes).toBe(250_000_000);
    expect(info.freeBytes).toBe(750_000_000);
    expect(info.usageFraction).toBeCloseTo(0.25);
  });

  it("returns null fraction when quota is zero (unknown)", async () => {
    stubNavigator({
      estimate: async () => ({ quota: 0, usage: 0 }),
    });
    const info = await readStorageInfo();
    expect(info.quotaBytes).toBeNull();
    expect(info.usageFraction).toBeNull();
  });

  it("clamps fraction at 1 even if usage > quota", async () => {
    stubNavigator({
      estimate: async () => ({ quota: 1_000_000, usage: 1_500_000 }),
    });
    const info = await readStorageInfo();
    expect(info.usageFraction).toBe(1);
    expect(info.freeBytes).toBe(0);
  });

  it("recovers from estimate() throwing", async () => {
    stubNavigator({
      estimate: async () => {
        throw new Error("blocked");
      },
    });
    const info = await readStorageInfo();
    expect(info.quotaBytes).toBeNull();
  });
});

describe("formatBytes", () => {
  it("returns '0' for null / non-finite / zero / negative inputs", () => {
    expect(formatBytes(null)).toBe("0");
    expect(formatBytes(0)).toBe("0");
    expect(formatBytes(-100)).toBe("0");
    expect(formatBytes(Number.NaN)).toBe("0");
  });

  it("formats with the appropriate unit", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(2_500_000_000)).toBe("2.3 GB");
  });

  it("uses integer formatting for large values within a unit", () => {
    expect(formatBytes(237 * 1024 * 1024)).toBe("237 MB");
  });
});
