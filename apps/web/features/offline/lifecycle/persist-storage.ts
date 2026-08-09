// Upgrades the origin's storage from best-effort to persistent (spec 6).
//
// By default a browser may evict an origin's IndexedDB + Cache Storage without
// warning once the device runs low on disk, oldest-used origin first — which
// for us means a user's saved books vanish silently. A granted `persist()`
// takes the origin out of that pool: only the user can clear it.
//
// Deliberately fire-and-forget at the call site: browsers grant on engagement
// heuristics (installed, bookmarked, high engagement), so a denial is normal
// and must never fail a save. Note this does NOT lift iOS Safari's 7-day
// visit-free wipe — only a home-screen install does (spec 6, Edge cases).

export async function ensurePersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function" ||
    typeof navigator.storage.persisted !== "function"
  ) {
    return false;
  }
  try {
    // Asking again once granted is wasted work, and on prompting browsers
    // (Firefox) it would re-prompt a user who already said yes.
    if (await navigator.storage.persisted()) {
      return true;
    }
    return await navigator.storage.persist();
  } catch {
    // Storage API blocked (private mode, embedded webview) — treat exactly
    // like a denial; the save proceeds on best-effort storage.
    return false;
  }
}
