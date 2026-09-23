import { isLibraryItemDeleted } from "../deleted-items";
import type { LibraryBookCollectionsPayload } from "@/lib/api-types/library";
import { getDb, type AvaReaderDB } from "../../../db";
import { applyCollectionPayload } from "../collections/write-library";
import { markMembershipChange } from "./bucket";
import type { MembershipMutation } from "./types";
import { bumpCompletionRevision, recordCompletionAck } from "../../../completion/state";

// Full affected shelves establish a shared count/membership baseline. Rebase
// every remaining local edit in the same transaction, including other books.
export async function acknowledgeMembership(
  db: AvaReaderDB,
  sent: MembershipMutation,
  payload?: LibraryBookCollectionsPayload,
  snapshotCompletionRevision = 0,
): Promise<void> {
  if (getDb() !== db) return;
  markMembershipChange();
  await db.transaction("rw", [db.libraryItems, db.collections, db.collectionMembership, db.collectionMembershipMutations, db.meta], async () => {
    if (await isLibraryItemDeleted(db, sent.libraryItemId)) return ;
    for (const collection of payload?.affectedCollections ?? []) {
      await applyCollectionPayload(collection, true, db, { snapshotCompletionRevision });
    }
    if (payload) {
      await recordCompletionAck(db, sent.libraryItemId, {
        memberships: Object.fromEntries(sent.changes.map((change) => [change.collectionId,
          payload.collections.some((collection) => collection.id === change.collectionId)])),
      });
      const book = await db.libraryItems.get(sent.libraryItemId);
      if (book?.details) await db.libraryItems.update(book.libraryItemId, {
        details: { ...book.details, collections: payload.collections },
      });
    } else await bumpCompletionRevision(db);
    const pending = await db.collectionMembershipMutations.toArray();
    for (const row of pending) {
      const changes = row.changes.filter((change) =>
        row.libraryItemId !== sent.libraryItemId ||
        !sent.changes.some((entry) => entry.collectionId === change.collectionId && entry.member === change.member),
      ).map((change) => {
        const collection = payload?.affectedCollections.find((entry) => entry.id === change.collectionId);
        return collection ? {
          ...change,
          baselineMember: collection.books.some((book) => book.libraryItemId === row.libraryItemId),
        } : change;
      });
      if (changes.length) await db.collectionMembershipMutations.put({ ...row, changes });
      else await db.collectionMembershipMutations.delete(row.libraryItemId);
    }
  });
  markMembershipChange();
}
