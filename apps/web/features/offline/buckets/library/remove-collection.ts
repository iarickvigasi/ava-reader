import { getDb } from "../../db";
import { bumpCompletionRevision } from "../../completion/state";
import { markMembershipChange } from "./membership/bucket";
import { refreshFromDb } from "./bucket";

// Called after the server confirms deletion; independent of the follow-up refresh succeeding.
export async function removeCollectionFromCache(
  collectionId: string,
): Promise<void> {
  const db = getDb();
  markMembershipChange();
  await db.transaction(
    "rw",
    [
      db.collections,
      db.collectionMembership,
      db.libraryItems,
      db.home,
      db.collectionMembershipMutations,
      db.meta,
    ],
    async () => {
      await bumpCompletionRevision(db);
      const pending = await db.collectionMembershipMutations.toArray();
      for (const mutation of pending) {
        const changes = mutation.changes.filter(
          (change) => change.collectionId !== collectionId,
        );
        if (changes.length)
          await db.collectionMembershipMutations.put({ ...mutation, changes });
        else
          await db.collectionMembershipMutations.delete(mutation.libraryItemId);
      }
      await db.collections.delete(collectionId);
      await db.collectionMembership
        .where("collectionId")
        .equals(collectionId)
        .delete();
      await db.libraryItems.toCollection().modify((row) => {
        if (row.details)
          row.details.collections = row.details.collections.filter(
            (entry) => entry.id !== collectionId,
          );
      });
      const home = await db.home.get("me");
      if (home)
        await db.home.put({
          ...home,
          payload: {
            ...home.payload,
            collections: {
              items: home.payload.collections.items.filter(
                (entry) => entry.id !== collectionId,
              ),
            },
          },
        });
    },
  );
  await refreshFromDb();
}
