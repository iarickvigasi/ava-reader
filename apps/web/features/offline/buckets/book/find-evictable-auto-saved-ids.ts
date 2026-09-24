import { getDb } from "../../db";

// Returns ids of auto-saved books without an explicit save or offline intent, other
// than the one currently open. In steady state there's at most one, but a
// release ([[4.3-save-button]]) can briefly leave a second, so this
// returns all of them. The reader uses it to drop stale auto-caches when the
// user opens another book (see ./evict).
export async function findEvictableAutoSavedIds(
  currentLibraryItemId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db.libraryItems
    .filter(
      (row) =>
        row.savedAutomatically && !row.savedOffline && !row.offlineRequested,
    )
    .toArray();
  return rows
    .filter((row) => row.libraryItemId !== currentLibraryItemId)
    .map((row) => row.libraryItemId);
}
