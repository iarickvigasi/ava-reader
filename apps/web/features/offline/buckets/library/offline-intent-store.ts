// The local half of the server-synced "keep this book offline" intent: every
// write that flips the flag or its dirty bookkeeping. The flush loop that
// PATCHes these rows lives next door in offline-intent-sync.ts.

import { getDb, type LibraryItemRow } from "../../db";

// Optimistically toggles the "keep offline" intent on a library row and marks
// it dirty so the sync flush PATCHes it. Returns false if the row isn't cached
// yet (the caller hasn't hydrated the book) — nothing to toggle.
export async function setOfflineRequestedLocal(
  libraryItemId: string,
  requested: boolean,
): Promise<boolean> {
  return patchItemRow(libraryItemId, {
    offlineRequested: requested,
    offlineRequestedDirty: true,
  });
}

// Promotes an already-cached (auto-saved) book to an explicit, sticky offline
// save: flips `savedOffline` so the eviction pass stops treating it as the
// evictable auto-slot, and sets the synced `offlineRequested` intent (dirty,
// for the next flush). Content is already on disk, so no download is needed —
// this takes effect immediately, even offline. Returns false if not cached.
export async function markOfflineKeptLocal(
  libraryItemId: string,
): Promise<boolean> {
  return patchItemRow(libraryItemId, {
    savedOffline: true,
    offlineRequested: true,
    offlineRequestedDirty: true,
  });
}

// Releases an explicitly-kept book back to an evictable auto-cache WITHOUT
// deleting its content: clears the synced `offlineRequested` intent (dirty, for
// the next flush) and `savedOffline`, and marks it `savedAutomatically` so the
// normal eviction pass can reclaim it later. The chapters/cover stay on disk,
// so it's still readable offline until eviction. Returns false if not cached.
export async function markOfflineReleasedLocal(
  libraryItemId: string,
): Promise<boolean> {
  return patchItemRow(libraryItemId, {
    savedOffline: false,
    savedAutomatically: true,
    offlineRequested: false,
    offlineRequestedDirty: true,
  });
}

// Rows with an offline-intent toggle that hasn't reached the server yet.
export async function listOfflineIntentDirty(): Promise<LibraryItemRow[]> {
  const db = getDb();
  return db.libraryItems
    .filter((row) => row.offlineRequestedDirty === true)
    .toArray();
}

// Clears the dirty flag after a successful PATCH — but only if the local value
// still matches what we synced (a newer toggle during the request stays dirty).
export async function markOfflineIntentClean(
  libraryItemId: string,
  syncedValue: boolean,
): Promise<void> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row || row.offlineRequested !== syncedValue) {
    return;
  }
  await db.libraryItems.put({ ...row, offlineRequestedDirty: false });
}

// Merges a patch into one cached row. False when the row isn't cached — the
// caller's book has never been hydrated, so there is nothing to toggle.
async function patchItemRow(
  libraryItemId: string,
  patch: Partial<LibraryItemRow>,
): Promise<boolean> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    return false;
  }
  await db.libraryItems.put({ ...row, ...patch });
  return true;
}
