import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOfflineModalSeen,
  hasSeenOfflineModal,
  markOfflineModalSeen,
} from "./seen-modal";

function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

let storage: ReturnType<typeof makeLocalStorageStub>;

beforeEach(() => {
  storage = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline modal seen flag", () => {
  it("defaults to unseen", () => {
    expect(hasSeenOfflineModal()).toBe(false);
  });

  it("reports seen after marking", () => {
    markOfflineModalSeen();
    expect(hasSeenOfflineModal()).toBe(true);
    expect(storage.store.get("ava-offline-modal:seen")).toBe("1");
  });

  it("clears the flag", () => {
    markOfflineModalSeen();
    clearOfflineModalSeen();
    expect(hasSeenOfflineModal()).toBe(false);
  });

  it("degrades to unseen when storage throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(() => markOfflineModalSeen()).not.toThrow();
    expect(hasSeenOfflineModal()).toBe(false);
  });
});
