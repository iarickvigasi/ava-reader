// Dev-only hygiene: a worker registered by a previous production-build
// session at this origin (offline testing runs `next start` on :3000, spec 14)
// would keep controlling dev pages and cache-first the dev server's mutable
// chunks — stale JS/CSS and hydration mismatches. Both phases are best-effort
// and independent: a failure in one never blocks the other or the app.

type ServiceWorkerContainerLike = {
  getRegistrations: () => Promise<
    ReadonlyArray<{ unregister: () => Promise<boolean> }>
  >;
};

type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
};

const SW_CACHE_PREFIX = "ava-reader-sw-";

export async function cleanupLeftoverServiceWorkers(
  container: ServiceWorkerContainerLike | undefined,
  cacheStorage: CacheStorageLike | undefined,
): Promise<void> {
  if (container) {
    try {
      const registrations = await container.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
    } catch {
      // Ignore — cache cleanup below still runs.
    }
  }
  if (cacheStorage) {
    try {
      const names = await cacheStorage.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(SW_CACHE_PREFIX))
          .map((name) => cacheStorage.delete(name)),
      );
    } catch {
      // Ignore — best-effort.
    }
  }
}
