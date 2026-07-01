// Storage-quota probe used by saveBookOffline before it starts pulling a
// book down. The Storage API's `estimate()` returns approximate `quota` and
// `usage` in bytes; we refuse to start a save when the headroom drops below
// the configured floor (default 100 MB), so the user gets a clear toast
// instead of a half-written cache + a QuotaExceededError mid-flight.
//
// Designed to be cheap and unintrusive: if the API isn't available (older
// browsers, SSR) we return `{ ok: true, freeBytes: null }` and let the save
// proceed — the underlying IndexedDB write will still error out if the
// device truly runs out of space.

export const DEFAULT_QUOTA_FLOOR_BYTES = 100 * 1024 * 1024; // 100 MB

export type QuotaCheck =
  | { ok: true; freeBytes: number | null }
  | { ok: false; freeBytes: number; quota: number; usage: number };

export async function checkStorageQuota(
  floorBytes: number = DEFAULT_QUOTA_FLOOR_BYTES,
): Promise<QuotaCheck> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return { ok: true, freeBytes: null };
  }
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return { ok: true, freeBytes: null };
  }
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  // Some browsers return zero quota (origin not yet using storage, or
  // private-mode quirks). Treat that as "we don't really know" and allow.
  if (!quota || quota <= 0) {
    return { ok: true, freeBytes: null };
  }
  const free = Math.max(0, quota - usage);
  if (free < floorBytes) {
    return { ok: false, freeBytes: free, quota, usage };
  }
  return { ok: true, freeBytes: free };
}
