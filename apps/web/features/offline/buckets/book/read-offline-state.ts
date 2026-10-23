import { getDb } from "../../db";
import { hasBookContent } from "./has-book-content";

// How the book is held offline, for the book-info "Download for offline" card:
//   - "absent"   → no content cached → offer "Save for offline".
//   - "auto"     → cached implicitly while reading; evictable (the single
//                  auto-save slot). Offer "Keep for offline" to make it sticky.
//   - "explicit" → the user (or a synced intent) chose to keep it. Offer
//                  "Remove from downloads".
// Distinguishes auto from explicit via the LibraryItem's `savedOffline` flag,
// which `hasBookContent` alone can't tell apart.
export type OfflineState = "absent" | "auto" | "explicit";

// Detailed offline state for the book-info card. `fromAutoSave` is only
// meaningful for "explicit": it records whether the book was originally
// auto-saved (so "stop keeping" preserves the cached content and drops back to
// the evictable auto-cache) versus explicitly downloaded from scratch (so
// "remove" deletes it and returns to "Save for offline").
// `offlineRequested` is the server-synced "keep this book offline" intent
// (see [[4.2-save-sync]]). It is reported even when state is "absent"
// (no content cached yet) so the book-info card can show "Download queued" —
// a request made offline must survive leaving and reopening the page.
export type OfflineDetail = {
  state: OfflineState;
  fromAutoSave: boolean;
  offlineRequested: boolean;
};

export async function readOfflineState(
  libraryItemId: string,
): Promise<OfflineDetail> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  const offlineRequested = row?.offlineRequested === true;
  if (!(await hasBookContent(libraryItemId))) {
    return { state: "absent", fromAutoSave: false, offlineRequested };
  }
  return {
    state: row?.savedOffline ? "explicit" : "auto",
    fromAutoSave: row?.savedAutomatically === true,
    offlineRequested,
  };
}
