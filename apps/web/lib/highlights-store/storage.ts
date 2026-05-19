// localStorage I/O for the highlights store. Wrapped in try/catches because
// storage can throw (quota exceeded, disabled, SSR) — we always fall back to
// an empty in-memory state rather than crashing the reader.

import {
  STORAGE_VERSION,
  type HighlightsStorageV1,
  type PendingMutation,
} from "./types";

const STORAGE_KEY_PREFIX = "ava-reader:highlights:";

export function storageKey(libraryItemId: string): string {
  return `${STORAGE_KEY_PREFIX}${libraryItemId}`;
}

function emptyState(): HighlightsStorageV1 {
  return { version: STORAGE_VERSION, snapshot: [], pending: [] };
}

export function readStorage(libraryItemId: string): HighlightsStorageV1 {
  if (typeof window === "undefined") {
    return emptyState();
  }
  try {
    const raw = window.localStorage.getItem(storageKey(libraryItemId));
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as Partial<HighlightsStorageV1>;
    // Current version — trust the whole payload.
    if (parsed.version === STORAGE_VERSION) {
      return {
        version: STORAGE_VERSION,
        snapshot: Array.isArray(parsed.snapshot) ? parsed.snapshot : [],
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      };
    }
    // Older or unknown version. The snapshot shape may have changed
    // incompatibly, but the *pending queue* is the user's unflushed intent —
    // never silently throw it away. Salvage what we can: drop pending entries
    // we can't safely re-serialize, keep the ones that still look valid.
    // The server snapshot will be re-fetched on next load anyway.
    return {
      version: STORAGE_VERSION,
      snapshot: [],
      pending: salvagePending(parsed.pending),
    };
  } catch {
    return emptyState();
  }
}

// Best-effort filter that keeps pending entries whose shape we still
// recognise. If we ever change PendingMutation incompatibly, this is the one
// place to add a version-specific transform.
function salvagePending(value: unknown): PendingMutation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is PendingMutation => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const m = entry as Partial<PendingMutation>;
    if (typeof m.id !== "string" || typeof m.queuedAt !== "string") {
      return false;
    }
    if (m.kind === "delete") {
      return true;
    }
    if (m.kind === "upsert") {
      const payload = (m as { payload?: unknown }).payload as
        | Record<string, unknown>
        | undefined;
      return (
        !!payload &&
        typeof payload.excerpt === "string" &&
        typeof payload.highlightColor === "string"
      );
    }
    return false;
  });
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
