// localStorage I/O for the highlights store. Wrapped in try/catches because
// storage can throw (quota exceeded, disabled, SSR) — we always fall back to
// an empty in-memory state rather than crashing the reader.

import { STORAGE_VERSION, type HighlightsStorageV1 } from "./types";

const STORAGE_KEY_PREFIX = "ava-reader:highlights:";

export function storageKey(libraryItemId: string): string {
  return `${STORAGE_KEY_PREFIX}${libraryItemId}`;
}

export function readStorage(libraryItemId: string): HighlightsStorageV1 {
  if (typeof window === "undefined") {
    return { version: STORAGE_VERSION, snapshot: [], pending: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(libraryItemId));
    if (!raw) {
      return { version: STORAGE_VERSION, snapshot: [], pending: [] };
    }
    const parsed = JSON.parse(raw) as Partial<HighlightsStorageV1>;
    if (parsed.version !== STORAGE_VERSION) {
      return { version: STORAGE_VERSION, snapshot: [], pending: [] };
    }
    return {
      version: STORAGE_VERSION,
      snapshot: Array.isArray(parsed.snapshot) ? parsed.snapshot : [],
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
    };
  } catch {
    return { version: STORAGE_VERSION, snapshot: [], pending: [] };
  }
}

export function writeStorage(
  libraryItemId: string,
  state: HighlightsStorageV1,
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      storageKey(libraryItemId),
      JSON.stringify(state),
    );
  } catch {
    // Quota exceeded or storage disabled — the in-memory state still works
    // for the current session; we just lose the offline-replay on reload.
  }
}
