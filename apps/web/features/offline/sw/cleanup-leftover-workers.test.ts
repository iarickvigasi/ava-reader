import { describe, expect, it, vi } from "vitest";

import { cleanupLeftoverServiceWorkers } from "./cleanup-leftover-workers";

function fakeContainer(unregister = vi.fn(async () => true)) {
  return {
    unregister,
    container: {
      getRegistrations: async () => [{ unregister }, { unregister }],
    },
  };
}

function fakeCacheStorage(names: string[]) {
  const deleted: string[] = [];
  return {
    deleted,
    cacheStorage: {
      keys: async () => names,
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    },
  };
}

describe("cleanupLeftoverServiceWorkers", () => {
  it("unregisters every registration and deletes only ava-reader caches", async () => {
    const { unregister, container } = fakeContainer();
    const { deleted, cacheStorage } = fakeCacheStorage([
      "ava-reader-sw-prod",
      "ava-reader-sw-dev",
      "unrelated-cache",
    ]);

    await cleanupLeftoverServiceWorkers(container, cacheStorage);

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(deleted).toEqual(["ava-reader-sw-prod", "ava-reader-sw-dev"]);
  });

  it("still deletes caches when the service worker API is unavailable", async () => {
    const { deleted, cacheStorage } = fakeCacheStorage(["ava-reader-sw-prod"]);

    await cleanupLeftoverServiceWorkers(undefined, cacheStorage);

    expect(deleted).toEqual(["ava-reader-sw-prod"]);
  });

  it("still deletes caches when unregistration fails", async () => {
    const container = {
      getRegistrations: async () => {
        throw new Error("boom");
      },
    };
    const { deleted, cacheStorage } = fakeCacheStorage(["ava-reader-sw-prod"]);

    await expect(
      cleanupLeftoverServiceWorkers(container, cacheStorage),
    ).resolves.toBeUndefined();
    expect(deleted).toEqual(["ava-reader-sw-prod"]);
  });
});
