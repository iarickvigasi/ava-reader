// Offline-capable sync for the "keep this book offline" intent
// (see specs/12-offline-save-sync). A toggle writes optimistically to Dexie and
// marks the row dirty; this module PATCHes dirty rows to the server and clears
// the flag on success. A toggle made while offline simply stays dirty until the
// next online flush. Mirrors the preferences bucket's dirty-then-flush model.

import { getPublicApiBaseUrl } from "@/lib/api";

import { refreshFromDb } from "./bucket";
import {
  listOfflineIntentDirty,
  markOfflineIntentClean,
  markOfflineKeptLocal,
  markOfflineReleasedLocal,
  setOfflineRequestedLocal,
} from "./storage";

type GetToken = () => Promise<string | null>;

let flushing: Promise<void> | null = null;

// Optimistically records the intent locally, updates the in-memory view, then
// kicks a flush. Safe to call offline — the flush no-ops and the dirty row is
// drained on the next online tick. Returns false if the book isn't cached yet.
export async function setBookOfflineIntent(
  libraryItemId: string,
  requested: boolean,
  getToken: GetToken,
): Promise<boolean> {
  const applied = await setOfflineRequestedLocal(libraryItemId, requested);
  if (!applied) {
    return false;
  }
  await refreshFromDb();
  void flushOfflineIntents(getToken).catch(() => {});
  return true;
}

// Promotes an auto-saved book to a sticky explicit offline save. The content is
// already on disk, so this just flips the local flags (immediately, even
// offline) and syncs the intent on the next flush. Returns false if the book
// isn't cached. Used by the book-info "Keep for offline" action.
export async function promoteBookOffline(
  libraryItemId: string,
  getToken: GetToken,
): Promise<boolean> {
  const applied = await markOfflineKeptLocal(libraryItemId);
  if (!applied) {
    return false;
  }
  await refreshFromDb();
  void flushOfflineIntents(getToken).catch(() => {});
  return true;
}

// Releases a kept book back to an evictable auto-cache (the inverse of
// promoteBookOffline) without deleting content. Flips the local flags
// immediately and syncs the cleared intent on the next flush. Returns false if
// the book isn't cached. Used by the book-info "stop keeping offline" action.
export async function releaseBookOffline(
  libraryItemId: string,
  getToken: GetToken,
): Promise<boolean> {
  const applied = await markOfflineReleasedLocal(libraryItemId);
  if (!applied) {
    return false;
  }
  await refreshFromDb();
  void flushOfflineIntents(getToken).catch(() => {});
  return true;
}

export async function flushOfflineIntents(getToken: GetToken): Promise<void> {
  if (flushing) {
    return flushing;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  flushing = doFlush(getToken).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(getToken: GetToken): Promise<void> {
  const dirty = await listOfflineIntentDirty();
  if (dirty.length === 0) {
    return;
  }
  const token = await getToken();
  if (!token) {
    return;
  }
  for (const row of dirty) {
    const requested = row.offlineRequested === true;
    try {
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
          row.libraryItemId,
        )}/offline`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requested }),
        },
      );
      if (!response.ok) {
        // Transient — leave it dirty, the next online tick retries.
        continue;
      }
      await markOfflineIntentClean(row.libraryItemId, requested);
    } catch {
      // Network blip — same recovery as a 5xx: stays dirty.
    }
  }
}

// Test-only: clear the module flush guard so each case starts fresh.
export function __resetOfflineIntentSyncForTests() {
  flushing = null;
}
