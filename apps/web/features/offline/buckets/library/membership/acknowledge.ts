import type { LibraryBookCollectionsPayload } from "@/lib/api-types/library";
import { getDb, type AvaReaderDB } from "../../../db";
import { applyCollectionPayload } from "../collections/write-library";
import { markMembershipChange } from "./bucket";
import type { MembershipMutation } from "./types";

// Full affected shelves establish a shared count/membership baseline. Rebase
// every remaining local edit in the same transaction, including other books.
export async function acknowledgeMembership(
  db: AvaReaderDB,
  sent: MembershipMutation,
  payload?: LibraryBookCollectionsPayload,
): Promise<void> {
  if (getDb() !== db) return;
  markMembershipChange();
  await db.transaction("rw", [db.libraryItems, db.collections, db.collectionMembership, db.collectionMembershipMutations], async () => {
    for (const collection of payload?.affectedCollections ?? []) {
      await applyCollectionPayload(collection, true, db);
    }
    if (payload) {
      const book = await db.libraryItems.get(sent.libraryItemId);
      if (book?.details) await db.libraryItems.update(book.libraryItemId, {
        details: { ...book.details, collections: payload.collections },
      });
    }
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
