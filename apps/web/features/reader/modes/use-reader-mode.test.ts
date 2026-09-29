import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useReaderMode } from "./use-reader-mode";

const harness = vi.hoisted(() => ({
  state: undefined as unknown,
  server: false,
}));
vi.mock("react", () => ({
  useState: (initialize: () => unknown) => {
    harness.state ??= initialize();
    return [
      harness.state,
      (next: unknown) => {
        harness.state = next;
      },
    ];
  },
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (
    _subscribe: unknown,
    client: () => boolean,
    server: () => boolean,
  ) => (harness.server ? server() : client()),
}));

let storage: Map<string, string>;
beforeEach(() => {
  harness.state = undefined;
  harness.server = false;
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("restores independent modes when switching books in the mounted shell", () => {
  expect(useReaderMode("/app/read/a")[0]).toBe(false);
  useReaderMode("/app/read/a")[1]();
  expect(useReaderMode("/app/read/a")[0]).toBe(true);
  expect(useReaderMode("/app/read/b")[0]).toBe(false);
  useReaderMode("/app/read/b")[1]();
  useReaderMode("/app/read/b")[1]();
  expect(useReaderMode("/app/read/a")[0]).toBe(true);
  expect(useReaderMode("/app/read/b")[0]).toBe(false);
  expect(storage.get("ava.reader.mode:/app/read/a")).toBe("bilingual");
  expect(storage.get("ava.reader.mode:/app/read/b")).toBe("plain");
});

it("restores the saved book after remount, including a trailing slash", () => {
  useReaderMode("/app/read/a")[1]();
  harness.state = undefined;
  expect(useReaderMode("/app/read/a/")[0]).toBe(true);
});

it("ignores the legacy global mode and invalid book values", () => {
  storage.set("ava.reader.mode", "bilingual");
  storage.set("ava.reader.mode:/app/read/a", "invalid");
  expect(useReaderMode("/app/read/a")[0]).toBe(false);
  expect(useReaderMode("/app/read/b")[0]).toBe(false);
});

it("keeps toggling available when storage is blocked", () => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    },
  });
  useReaderMode("/app/read/a")[1]();
  expect(useReaderMode("/app/read/a")[0]).toBe(true);
  expect(useReaderMode("/app/read/b")[0]).toBe(false);
});

it("keeps the server snapshot plain until hydration", () => {
  storage.set("ava.reader.mode:/app/read/a", "bilingual");
  harness.server = true;
  expect(useReaderMode("/app/read/a")[0]).toBe(false);
  harness.server = false;
  expect(useReaderMode("/app/read/a")[0]).toBe(true);
});

it("does not save a mode before the reader URL is available", () => {
  expect(useReaderMode(null)[0]).toBe(false);
  useReaderMode(null)[1]();
  expect(storage.size).toBe(0);
});
