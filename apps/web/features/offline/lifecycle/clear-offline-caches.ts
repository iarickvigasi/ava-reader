// Deletes the service-worker caches on sign-out / account switch (adr/5, spec
// 16). The SW caches rendered shells that bake the signed-in user's nav (display
// name, admin entry), keyed by path — not per-user — so they must be dropped so
// the next account can't be served the previous user's shell. Names are
// versioned `ava-reader-sw-<build>`; the next user re-caches their own.

export const SW_CACHE_PREFIX = "ava-reader-sw-";

export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(SW_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
  } catch {
    // Cache Storage unavailable — best effort.
  }
}
