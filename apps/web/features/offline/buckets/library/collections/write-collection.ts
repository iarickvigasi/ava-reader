import type { LibraryCollection } from "@/lib/api-types/library";
import { getDb } from "../../../db";
import { isLibraryItemDeleted } from "../deleted-items";
import {
  readCompletionRevision,
  type CompletionWriteOptions,
} from "../../../completion/state";
import { bookToItemRow, collectionToRow, membershipRows } from "./payload-rows";
import { mergeOntoCachedTx } from "./merge-cached-items";

// Same as applyLibraryPayload but only touches one collection — used by the
// /app/library/collections/[slug] route so reading a single collection
// page doesn't wipe siblings.
export async function applyCollectionPayload(
  collection: LibraryCollection,
  acknowledged = false,
  db = getDb(),
  options: CompletionWriteOptions = {},
) {
  if (db !== getDb()) return;
  const nowIso = new Date().toISOString();
  const items = collection.books.map((book) => bookToItemRow(book, nowIso));

  await db.transaction(
    "rw",
    [
      db.libraryItems,
      db.collections,
      db.collectionMembership,
      db.collectionMembershipMutations,
      db.meta,
    ],
    async () => {
      if (
        options.expectedCompletionRevision !== undefined &&
        options.expectedCompletionRevision !==
          (await readCompletionRevision(db))
      )
        return;
      for (const item of [
        ...collection.books,
        ...(collection.completionItems ?? []),
      ]) {
        if (await isLibraryItemDeleted(db, item.libraryItemId)) return;
      }
      if (!acknowledged) {
        const pending = await db.collectionMembershipMutations.toArray();
        if (
          pending.some((row) =>
            row.changes.some((change) => change.collectionId === collection.id),
          )
        )
          return;
      }
      const revision =
        options.snapshotCompletionRevision ??
        options.expectedCompletionRevision ??
        0;
      await db.libraryItems.bulkPut(
        await mergeOntoCachedTx(items, db, revision),
      );
      await db.collections.put({
        ...collectionToRow(collection),
        completionRevision: revision,
      });
      await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .delete();
      await db.collectionMembership.bulkPut(membershipRows(collection));
    },
  );
}
