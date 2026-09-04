// Membership writes for a library *list* payload. Runs inside the caller's
// Dexie transaction, so `collectionMembership` has to be in that transaction's
// table list — the same arrangement as summary-store.

import type { LibraryPayload } from "@/lib/api-types/library";

import { groupMembershipByCollection } from "./membership-index";

import { getDb, type CollectionMembershipRow } from "../../db";

// Membership for the collections a list payload names. A collection is only
// replaced when its preview *is* the whole shelf (`books.length >= itemCount`);
// otherwise the rows are seeded once and then left alone, because preview
// orders (0…3 by engagement) would overwrite the real order with a partial one.
export async function replacePreviewMembershipTx(
  payload: LibraryPayload,
  memberships: CollectionMembershipRow[],
): Promise<void> {
  const db = getDb();
  const byCollection = groupMembershipByCollection(memberships);
  for (const collection of payload.collections) {
    const links = byCollection.get(collection.id) ?? [];
    const complete = collection.books.length >= collection.itemCount;
    if (!complete) {
      const cached = await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .count();
      if (cached > 0) {
        continue;
      }
    }
    await db.collectionMembership
      .where("collectionId")
      .equals(collection.id)
      .delete();
    await db.collectionMembership.bulkPut(links);
  }
}
