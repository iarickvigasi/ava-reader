// The library cache's only delete path.

import { getDb } from "../../db";

// Deletes every cached item outside `keepIds`, plus its membership rows. Only
// the primer may call this, and only after a pass that hydrated every
// collection in full — that is the one moment absence is knowable
// ([[4.4-cache-priming]]). A row with an unsynced offline toggle is kept: the
// user's intent has not reached the server yet.
export async function pruneLibraryItems(keepIds: string[]): Promise<void> {
  const db = getDb();
  const keep = new Set(keepIds);
  await db.transaction(
    "rw",
    [db.libraryItems, db.collectionMembership, db.collectionMembershipMutations, db.finishDateMutations],
    async () => {
      const pending = await db.collectionMembershipMutations.toArray();
      for (const mutation of pending) keep.add(mutation.libraryItemId);
      for (const mutation of await db.finishDateMutations.toArray()) {
        keep.add(mutation.libraryItemId);
      }
      const rows = await db.libraryItems.toArray();
      const stale = rows
        .filter((row) => !keep.has(row.libraryItemId))
        .filter((row) => !row.offlineRequestedDirty)
        .map((row) => row.libraryItemId);
      if (stale.length === 0) {
        return;
      }
      await db.libraryItems.bulkDelete(stale);
      await db.collectionMembership
        .where("libraryItemId")
        .anyOf(stale)
        .delete();
    },
  );
}
