// Membership writes for a library *list* payload. Runs inside the caller's
// Dexie transaction, so `collectionMembership` has to be in that transaction's
// table list — the same arrangement as summary-store.

import type { LibraryPayload } from "@/lib/api-types/library";

import { groupMembershipByCollection } from "./membership-index";

import { getDb, type CollectionMembershipRow } from "../../../db";

// Membership for the collections a list payload names. A collection is only
// replaced when its preview *is* the whole shelf (`books.length >= itemCount`);
// otherwise the latest preview leads and the remaining cached members keep
// their relative order. A partial preview cannot remove unseen members, but
// must still introduce newly imported books and update the leading order.
export async function replacePreviewMembershipTx(
  payload: LibraryPayload,
  memberships: CollectionMembershipRow[],
): Promise<void> {
  const db = getDb();
  const byCollection = groupMembershipByCollection(memberships);
  for (const collection of payload.collections) {
    let links = byCollection.get(collection.id) ?? [];
    const complete = collection.books.length >= collection.itemCount;
    if (!complete) {
      const cached = await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .toArray();
      const previewIds = new Set(links.map((link) => link.libraryItemId));
      links = [
        ...links,
        ...cached.sort((a, b) => a.order - b.order)
          .filter((link) => !previewIds.has(link.libraryItemId)),
      ].map((link, order) => ({ ...link, order }));
    }
    await db.collectionMembership
      .where("collectionId")
      .equals(collection.id)
      .delete();
    await db.collectionMembership.bulkPut(links);
  }
}
