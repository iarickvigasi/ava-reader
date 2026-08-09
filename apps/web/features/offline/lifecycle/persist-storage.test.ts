import { afterEach, describe, expect, it, vi } from "vitest";

import { ensurePersistentStorage } from "./persist-storage";

const realNavigator = globalThis.navigator;

afterEach(() => {
  // Restore whatever `navigator` looked like before each test, since we
  // stub `navigator.storage` to exercise the request.
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

describe("ensurePersistentStorage", () => {
  it("returns false when navigator.storage is unavailable", async () => {
    stubNavigator(undefined);
    expect(await ensurePersistentStorage()).toBe(false);
  });

  it("returns false when persist() is unsupported", async () => {
    stubNavigator({ persisted: async () => false });
    expect(await ensurePersistentStorage()).toBe(false);
  });

  it("short-circuits without re-asking when the grant already exists", async () => {
    const persist = vi.fn(async () => true);
    stubNavigator({ persisted: async () => true, persist });

    expect(await ensurePersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests the grant and reports success", async () => {
    const persist = vi.fn(async () => true);
    stubNavigator({ persisted: async () => false, persist });

    expect(await ensurePersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports a denial without throwing", async () => {
    stubNavigator({ persisted: async () => false, persist: async () => false });
    expect(await ensurePersistentStorage()).toBe(false);
  });

  it("recovers when persisted() throws", async () => {
    stubNavigator({
      persisted: async () => {
        throw new Error("blocked");
      },
      persist: async () => true,
    });
    expect(await ensurePersistentStorage()).toBe(false);
  });

  it("recovers when persist() throws", async () => {
    stubNavigator({
      persisted: async () => false,
      persist: async () => {
        throw new Error("blocked");
      },
    });
    expect(await ensurePersistentStorage()).toBe(false);
  });
});
