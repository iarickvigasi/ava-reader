// The one rule for overwriting a cached LibraryItemRow with a library or
// collection *list* payload: which fields the server owns, and which are local
// and must survive. Both list write paths (write-library.ts) apply it — a
// field added on one side and forgotten on the other silently wipes the user's
// offline state.

import type { LibraryItemRow } from "../../db";

// Layers an already-cached row's locally-owned fields back onto a row built
// from a fresh payload. A list payload carries neither offline-save state nor
// book-info details, so re-hydrating from one must not erase them.
export function mergeListPayloadItemRow(
  next: LibraryItemRow,
  prior: LibraryItemRow | undefined,
): LibraryItemRow {
  if (!prior) {
    return next;
  }
  return {
    ...next,
    coverBlob: prior.coverBlob,
    savedOffline: prior.savedOffline,
    savedAutomatically: prior.savedAutomatically,
    savedAt: prior.savedAt,
    // A locally-toggled offline intent that hasn't synced yet wins over the
    // server payload; otherwise the server value (already in `next`) stands.
    ...(prior.offlineRequestedDirty
      ? {
          offlineRequested: prior.offlineRequested,
          offlineRequestedDirty: true,
        }
      : {}),
    // Preserve any book-info details already cached. A library list payload
    // doesn't carry these, so re-hydrating from one must not wipe them.
    details: prior.details,
    detailsFetchedAt: prior.detailsFetchedAt,
  } satisfies LibraryItemRow;
}
