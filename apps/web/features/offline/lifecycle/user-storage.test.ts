import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearUserScopedClientStorage } from "./user-storage";

function makeLocalStorage(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

let cookieWrites: string[];

beforeEach(() => {
  cookieWrites = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearUserScopedClientStorage", () => {
  it("removes user-scoped keys but preserves the active-user marker and unrelated keys", () => {
    const ls = makeLocalStorage({
      "ava.reader.fontScale": "1.2",
      "ava.interfaceLang": "uk",
      "ava-reader:resume:book-1": "{}",
      "ava-theme": "dark",
      "ava-offline-modal:seen": "1",
      "ava-reader:active-user": "user-a",
      unrelated: "keep",
    });
    vi.stubGlobal("window", { localStorage: ls });
    vi.stubGlobal("document", {
      set cookie(v: string) {
        cookieWrites.push(v);
      },
      get cookie() {
        return "";
      },
    });

    clearUserScopedClientStorage();

    expect(ls.store.has("ava.reader.fontScale")).toBe(false);
    expect(ls.store.has("ava.interfaceLang")).toBe(false);
    expect(ls.store.has("ava-reader:resume:book-1")).toBe(false);
    expect(ls.store.has("ava-theme")).toBe(false);
    expect(ls.store.has("ava-offline-modal:seen")).toBe(false);
    // Must NOT clear the active-user marker (managed separately) or unrelated keys.
    expect(ls.store.get("ava-reader:active-user")).toBe("user-a");
    expect(ls.store.get("unrelated")).toBe("keep");
  });

  it("expires the theme and locale cookies", () => {
    vi.stubGlobal("window", { localStorage: makeLocalStorage({}) });
    vi.stubGlobal("document", {
      set cookie(v: string) {
        cookieWrites.push(v);
      },
      get cookie() {
        return "";
      },
    });

    clearUserScopedClientStorage();

    expect(
      cookieWrites.some((c) => c.startsWith("ava-theme=") && c.includes("max-age=0")),
    ).toBe(true);
    expect(
      cookieWrites.some((c) => c.startsWith("ava-locale=") && c.includes("max-age=0")),
    ).toBe(true);
  });

  it("no-ops (does not throw) when window is unavailable", () => {
    expect(() => clearUserScopedClientStorage()).not.toThrow();
  });
});
