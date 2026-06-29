import { afterEach, describe, expect, it, vi } from "vitest";

import { clearOfflineCaches } from "./clear-offline-caches";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearOfflineCaches", () => {
  it("deletes only the ava-reader-sw-* caches", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => ["ava-reader-sw-abc", "ava-reader-sw-def", "other-cache"],
      delete: async (k: string) => {
        deleted.push(k);
        return true;
      },
    });

    await clearOfflineCaches();

    expect(deleted).toEqual(
      expect.arrayContaining(["ava-reader-sw-abc", "ava-reader-sw-def"]),
    );
    expect(deleted).not.toContain("other-cache");
  });

  it("no-ops (resolves) when Cache Storage is unavailable", async () => {
    await expect(clearOfflineCaches()).resolves.toBeUndefined();
  });
});
