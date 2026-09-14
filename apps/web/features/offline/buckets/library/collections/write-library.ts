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

import { getDb, type AvaReaderDB, type LibraryItemRow } from "../../../db";
import { readProtectedCollections } from "../membership/protected-collections";
import { COMPLETION_CHANGE_PREFIX, readCompletionRevision, type CompletionChange, type CompletionWriteOptions } from "../../../completion/state";

// Replaces the entire library cache with a fresh server payload. We delete
// rows that are no longer present so collections / books removed on another
// device disappear here too. Highlights, books, sessions etc. are untouched —
// they're managed by their own buckets.
export async function applyLibraryPayload(payload: LibraryPayload, options: CompletionWriteOptions = {}) {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  const { collections, items, memberships } = collectPayloadRows(
    payload,
    new Date().toISOString(),
  );

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership, db.collectionMembershipMutations, db.meta],
    async () => {
      if (options.expectedCompletionRevision !== undefined &&
        options.expectedCompletionRevision !== await readCompletionRevision(db)) return;
      const nextItems = await mergeOntoCachedTx(items, db, options.expectedCompletionRevision ?? 0);
      const { ids: protectedIds, rows: protectedRows } = await readProtectedCollections();

      // Only collection absence is authoritative here: books are previews.
      await db.collections.clear();
      await db.collections.bulkPut([
        ...collections.filter((collection) => !protectedIds.has(collection.id)).map((collection) => ({
          ...collection, completionRevision: options.expectedCompletionRevision ?? 0,
        })),
        ...protectedRows,
      ]);

      await db.libraryItems.bulkPut(nextItems);
      await replacePreviewMembershipTx({
        ...payload,
        collections: payload.collections.filter((collection) => !protectedIds.has(collection.id)),
      }, memberships);
      await writeLibraryBooksCountTx(payload.summary.booksCount);
    },
  );
}

// Same as applyLibraryPayload but only touches one collection — used by the
// /app/library/collections/[slug] route so reading a single collection
// page doesn't wipe siblings.
export async function applyCollectionPayload(collection: LibraryCollection, acknowledged = false, db = getDb(), options: CompletionWriteOptions = {}) {
  if (db !== getDb()) return;
  const nowIso = new Date().toISOString();
  const items = collection.books.map((book) => bookToItemRow(book, nowIso));

  await db.transaction(
    "rw",
    [db.libraryItems, db.collections, db.collectionMembership, db.collectionMembershipMutations, db.meta],
    async () => {
      if (options.expectedCompletionRevision !== undefined &&
        options.expectedCompletionRevision !== await readCompletionRevision(db)) return;
      if (!acknowledged) {
        const pending = await db.collectionMembershipMutations.toArray();
        if (pending.some((row) => row.changes.some((change) => change.collectionId === collection.id))) return;
      }
      const revision = options.snapshotCompletionRevision ?? options.expectedCompletionRevision ?? 0;
      await db.libraryItems.bulkPut(await mergeOntoCachedTx(items, db, revision));
      await db.collections.put({ ...collectionToRow(collection), completionRevision: revision });
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
  db: AvaReaderDB = getDb(),
  revision = 0,
): Promise<LibraryItemRow[]> {
  const cached = await db
    .libraryItems.where("libraryItemId")
    .anyOf(rows.map((row) => row.libraryItemId))
    .toArray();
  const cachedById = new Map(cached.map((row) => [row.libraryItemId, row]));
  return Promise.all(rows.map(async (row) => {
    const change = (await db.meta.get(`${COMPLETION_CHANGE_PREFIX}${row.libraryItemId}`))?.value as CompletionChange | undefined;
    const next = {
      ...row,
      ...(change?.finishedAt && change.finishedAt.revision > revision ? { finishedAt: change.finishedAt.value } : {}),
      ...(change?.completionPercent && change.completionPercent.revision > revision ? { completionPercent: change.completionPercent.value } : {}),
    };
    return mergeListPayloadItemRow(next, cachedById.get(row.libraryItemId));
  }));
}
