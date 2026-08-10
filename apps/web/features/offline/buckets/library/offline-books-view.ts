// The Offline Books shelf is derived, not read. Membership comes from
// `offlineRequested` rather than the cached collectionMembership rows: it's the
// same rule the server applies, but evaluating it locally means a toggle made
// offline moves the book immediately instead of waiting for the dirty PATCH to
// flush — and that shelf matters most precisely when there's no connection.
// See docs/specs/17-offline-books-collection.md.

import type { LibraryItemRow } from "../../db";

import type { LibraryBookView } from "./types";

const FULLY_READ_PERCENT = 100;

// Ordered by the same engagement timestamp the server sorts collections by;
// LibraryItemRow.lastReadAt already carries it (max of progress.lastReadAt,
// lastOpenedAt and addedAt). Never-engaged rows sort last.
export function selectOfflineBookRows(
  rows: LibraryItemRow[],
): LibraryItemRow[] {
  return rows
    .filter((row) => row.offlineRequested)
    .sort((left, right) => engagementMs(right) - engagementMs(left));
}

// The server's itemCount/unreadCount for this collection describe the last
// synced membership, so they have to be recomputed alongside the derived books.
export function deriveOfflineCounts(books: LibraryBookView[]) {
  return {
    itemCount: books.length,
    unreadCount: books.filter(
      (book) => book.completionPercent < FULLY_READ_PERCENT,
    ).length,
  };
}

function engagementMs(row: LibraryItemRow): number {
  if (!row.lastReadAt) {
    return 0;
  }
  const parsed = Date.parse(row.lastReadAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}
