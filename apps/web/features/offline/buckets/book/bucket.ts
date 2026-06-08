// In-memory state for offline book saves: per-book status (idle/saving/saved/
// failed/missing), progress (current chapter, total), and the in-flight
// AbortController so a second save (typically the user opening a different
// book) can cancel an earlier one.
//
// Components subscribe via useSyncExternalStore (see ./hooks.ts) and re-read
// through a stable selector. Module-level state — there's one cache per
// browser profile, and we want every reader / button to see the same view.

import type { Listener } from "../library/types";

export type BookSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "failed"
  | "missing";

export type BookSaveSnapshot = {
  status: BookSaveStatus;
  // Chapters successfully written so far / total chapters discovered. Both
  // 0 until the orchestrator has enumerated the TOC.
  currentChapters: number;
  totalChapters: number;
  // Human-readable failure reason for the "failed" status — used by toasts
  // and the button's tooltip. Localised before being stored here.
  error: string | null;
};

const IDLE_SNAPSHOT: BookSaveSnapshot = {
  status: "idle",
  currentChapters: 0,
  totalChapters: 0,
  error: null,
};

type BucketState = {
  // Per-libraryItemId snapshots. Books not in the map default to IDLE_SNAPSHOT.
  byBook: Map<string, BookSaveSnapshot>;
  // In-flight AbortControllers, one per libraryItemId. Used to cancel a save
  // that's still running when a new one starts.
  inFlight: Map<string, AbortController>;
  listeners: Set<Listener>;
  // Bumped on every mutation; drives the stable-selector memo.
  version: number;
};

const state: BucketState = {
  byBook: new Map(),
  inFlight: new Map(),
  listeners: new Set(),
  version: 0,
};

function notify() {
  state.version += 1;
  for (const listener of state.listeners) {
    listener();
  }
}

export function subscribeToBookSave(listener: Listener): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function getBookSaveSnapshot(libraryItemId: string): BookSaveSnapshot {
  return state.byBook.get(libraryItemId) ?? IDLE_SNAPSHOT;
}

// SSR snapshot — always idle. The hook's effect populates the in-memory map
// from Dexie on mount, so the first client paint reconciles.
export function getServerSnapshot(): BookSaveSnapshot {
  return IDLE_SNAPSHOT;
}

export function setStatus(
  libraryItemId: string,
  patch: Partial<BookSaveSnapshot>,
): void {
  const prev = state.byBook.get(libraryItemId) ?? IDLE_SNAPSHOT;
  const next: BookSaveSnapshot = { ...prev, ...patch };
  if (
    prev.status === next.status &&
    prev.currentChapters === next.currentChapters &&
    prev.totalChapters === next.totalChapters &&
    prev.error === next.error
  ) {
    return;
  }
  state.byBook.set(libraryItemId, next);
  notify();
}

export function registerInFlight(
  libraryItemId: string,
  controller: AbortController,
): void {
  // Abort any pre-existing in-flight save for this same book first so we
  // don't leak two parallel orchestrators writing the same rows.
  const existing = state.inFlight.get(libraryItemId);
  if (existing) {
    existing.abort();
  }
  state.inFlight.set(libraryItemId, controller);
}

export function clearInFlight(libraryItemId: string): void {
  state.inFlight.delete(libraryItemId);
}

// True when any book save is currently in flight. The background primer reads
// this before starting a save so it never aborts a save the user just kicked
// off (saveBookOffline unconditionally aborts other in-flight saves); when a
// user save is running the primer yields and resumes on a later home load.
export function hasInFlightSaves(): boolean {
  return state.inFlight.size > 0;
}

// Cancel any in-flight save that ISN'T for `keepLibraryItemId`. Used when
// the user opens a different book mid-save: per spec, the prior save is
// abandoned (partial rows cleaned up by the orchestrator's abort handler).
export function abortInFlightExcept(keepLibraryItemId: string): void {
  for (const [id, controller] of state.inFlight) {
    if (id === keepLibraryItemId) {
      continue;
    }
    controller.abort();
  }
}

// Test-only — clears in-memory state without nuking Dexie.
export function __resetBookBucketForTests(): void {
  state.byBook.clear();
  for (const c of state.inFlight.values()) {
    c.abort();
  }
  state.inFlight.clear();
  state.listeners.clear();
  state.version = 0;
}
