// Eviction policy for the evictable auto-cache.
//
// The reader drives this (see ./use-evict-stale-auto-saves): while a book is
// open, online, and its own content is cached, every *other* auto-saved
// (non-sticky) book is disposable and gets dropped. The currently-open book is
// always exempt — you never lose the book you're reading. Explicit saves
// (`savedOffline`) are never candidates. It runs only when online, so a switch
// made offline keeps the previous cache and is reclaimed later, on reconnect.
//
// See [[6-offline-reading]].

import { deleteBookContent, findEvictableAutoSavedIds } from "./storage";

// Deletes the content of every auto-cached book other than the one currently
// open. Returns the ids it evicted (handy for tests / telemetry). Idempotent:
// a no-op when there's nothing stale to drop.
export async function evictStaleAutoSaves(
  currentLibraryItemId: string,
): Promise<string[]> {
  const ids = await findEvictableAutoSavedIds(currentLibraryItemId);
  for (const id of ids) {
    await deleteBookContent(id);
  }
  return ids;
}
