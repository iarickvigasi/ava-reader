"use client";

// Reader-driven eviction of stale auto-caches. The caller passes `enabled` =
// online AND the open book's own content is cached. Firing on that edge covers
// all three triggers with one rule:
//   - opening an already-cached book (enabled true on mount) → immediate,
//   - finishing the open book's own auto-save (its cache flips present) → safe,
//   - reconnecting while a book is open (online flips true) → a switch made
//     offline is reclaimed now.
// The open book is `currentLibraryItemId`, so it's always exempt; offline keeps
// `enabled` false, so nothing is dropped until the network returns.

import { useEffect } from "react";

import { evictStaleAutoSaves } from "./evict";

export function useEvictStaleAutoSaves(
  currentLibraryItemId: string,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    void evictStaleAutoSaves(currentLibraryItemId);
  }, [currentLibraryItemId, enabled]);
}
