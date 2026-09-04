// Dexie write paths for the library bucket: a whole library payload, or a
// single collection's. Each one reads as collect → merge → write; item-row.ts
// owns which fields are locally owned and so survive the merge.

import type {
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";

import { mergeListPayloadItemRow } from "./item-row";
import {
  bookToItemRow,
  collectPayloadRows,
  collectionToRow,
  membershipRows,
} from "./payload-rows";
import { replacePreviewMembershipTx } from "./preview-membership";
import { writeLibraryBooksCountTx } from "./summary-store";

import { getDb, type LibraryItemRow } from "../../../db";

// Replaces the entire library cache with a fresh server payload. We delete
// rows that are no longer present so collections / books removed on another
// device disappear here too. Highlights, books, sessions etc. are untouched —
// they're managed by their own buckets.
export async function applyLibraryPayload(payload: LibraryPayload) {
  const db = getDb();
  const { collections, items, memberships } = collectPayloadRows(
    payload,
    new Date().toISOString(),
  );

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership, db.meta],
    async () => {
      const nextItems = await mergeOntoCachedTx(items);

      // `collections` is the only table this payload can prove absence for —
      // it lists every collection. Items and membership are previews (4 books
      // per collection), so deleting from them here erased the primer's full
      // per-collection pass; pruning belongs to that pass instead
      // ([[4-offline/_overview]], Write paths).
      await db.collections.clear();
      await db.collections.bulkPut(collections);

      await db.libraryItems.bulkPut(nextItems);
      await replacePreviewMembershipTx(payload, memberships);
      await writeLibraryBooksCountTx(payload.summary.booksCount);
    },
  );
}

// Same as applyLibraryPayload but only touches one collection — used by the
// /app/library/collections/[slug] route so reading a single collection
// page doesn't wipe siblings.
export async function applyCollectionPayload(collection: LibraryCollection) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const items = collection.books.map((book) => bookToItemRow(book, nowIso));

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership],
    async () => {
      await db.libraryItems.bulkPut(await mergeOntoCachedTx(items));
      await db.collections.put(collectionToRow(collection));
      await db.collectionMembership
        .where("collectionId")
        .equals(collection.id)
        .delete();
      await db.collectionMembership.bulkPut(membershipRows(collection));
    },
  );
}

// Layers each payload row onto the cached one it replaces. Preserves the
// offline-save metadata a server payload doesn't carry: without this, a
// re-hydration stomps a book the user marked savedOffline.
async function mergeOntoCachedTx(
  rows: LibraryItemRow[],
): Promise<LibraryItemRow[]> {
  const cached = await getDb()
    .libraryItems.where("libraryItemId")
    .anyOf(rows.map((row) => row.libraryItemId))
    .toArray();
  const cachedById = new Map(cached.map((row) => [row.libraryItemId, row]));
  return rows.map((row) =>
    mergeListPayloadItemRow(row, cachedById.get(row.libraryItemId)),
  );
}
