// One-shot janitor for legacy substrates that were migrated to Dexie. The
// idea is to avoid leaking stale per-book entries in localStorage indefinitely
// after a migration — users typically don't clear browser storage, and even
// small leftover blobs add up across hundreds of books on a single profile.
//
// Each migration adds its key prefix here and lists a single sessionStorage
// flag, so the cleanup runs once per browser session at most (not on every
// page navigation). The flag is per-prefix so a future migration can be
// added without re-running prior cleanups.

import { LEGACY_LOCALSTORAGE_PREFIX as HIGHLIGHTS_PREFIX } from "./buckets/highlights";

type LegacyCleanupSpec = {
  // Key in window.sessionStorage that marks the cleanup as run for this
  // session. Once set, the cleanup is a no-op until the next tab.
  sessionFlag: string;
  // localStorage keys with this prefix are removed.
  keyPrefix: string;
};

const SPECS: LegacyCleanupSpec[] = [
  {
    sessionFlag: "ava-reader:legacy-cleanup:highlights",
    keyPrefix: HIGHLIGHTS_PREFIX,
  },
];

export function runLegacyLocalStorageCleanup(): void {
  if (typeof window === "undefined") {
    return;
  }
  for (const spec of SPECS) {
    try {
      if (window.sessionStorage.getItem(spec.sessionFlag) === "1") {
        continue;
      }
      removeKeysWithPrefix(spec.keyPrefix);
      window.sessionStorage.setItem(spec.sessionFlag, "1");
    } catch {
      // sessionStorage or localStorage disabled — best-effort, no toast.
    }
  }
}

function removeKeysWithPrefix(prefix: string): void {
  // Collect first, then delete: removing while iterating localStorage shifts
  // indices and we'd skip every other key.
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    window.localStorage.removeItem(key);
  }
}
