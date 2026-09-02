// The Offline Books shelf is derived, not read. Membership comes from
// `offlineRequested` rather than the cached collectionMembership rows: it's the
// same rule the server applies, but evaluating it locally means a toggle made
// offline moves the book immediately instead of waiting for the dirty PATCH to
// flush — and that shelf matters most precisely when there's no connection.
// See docs/specs/4-offline/4.8-offline-books-collection.md.

import type { LibraryItemRow } from "../../db";

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

// The counts, unlike the book list, cannot be derived from the cached rows: a
// library payload stores only each collection's 4-book preview, so counting
// `offlineRequested` rows reports a fraction of the shelf. The server's stored
// counts do cover the whole collection, so they are the base — adjusted by the
// toggles the server hasn't seen yet, which keeps an offline save visible in
// the number straight away.
export function resolveOfflineCounts(
  stored: { itemCount: number; unreadCount: number },
  rows: LibraryItemRow[],
) {
  const added = rows.filter(isLocallyAdded);
  const removed = rows.filter(isLocallyRemoved);
  return {
    // Clamped because the base is the last *synced* count: a book-info visit
    // can refresh a row's baseline without refreshing the shelf's stored
    // total, so a burst of un-saves can briefly outrun it. The next library
    // load restores both together.
    itemCount: atLeastZero(stored.itemCount + added.length - removed.length),
    unreadCount: atLeastZero(
      stored.unreadCount + countUnread(added) - countUnread(removed),
    ),
  };
}

// Saved locally since the last payload — the server's count is missing it.
function isLocallyAdded(row: LibraryItemRow): boolean {
  return row.offlineRequested === true && row.offlineRequestedBaseline === false;
}

// Un-saved locally since the last payload — the server's count still has it.
function isLocallyRemoved(row: LibraryItemRow): boolean {
  return !row.offlineRequested && row.offlineRequestedBaseline === true;
}

function countUnread(rows: LibraryItemRow[]): number {
  return rows.filter((row) => row.completionPercent < FULLY_READ_PERCENT)
    .length;
}

function atLeastZero(count: number): number {
  return Math.max(0, count);
}

function engagementMs(row: LibraryItemRow): number {
  if (!row.lastReadAt) {
    return 0;
  }
  const parsed = Date.parse(row.lastReadAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}
