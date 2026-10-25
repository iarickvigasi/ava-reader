import type { Transaction } from "dexie";
import type { CollectionRow, HomeRow, LibraryItemRow } from "../db";
import { KNOWN_SMART_KEYS } from "@/lib/smart-collections";

type CollectionIdentity = { id: string; kind: string; smartKey: string | null };

// Runs once inside Dexie's atomic version-upgrade transaction, before any cache reads.
export async function migrateRetiredCollections(
  tx: Transaction,
): Promise<void> {
  const ids = await findRetiredCollectionIds(tx);
  const removed = new Set(ids);
  const keep = (row: CollectionIdentity) => !removed.has(row.id);
  await tx
    .table("collectionMembership")
    .where("collectionId")
    .anyOf(ids)
    .delete();
  await tx.table("collections").bulkDelete(ids);
  await tx
    .table<LibraryItemRow, string>("libraryItems")
    .toCollection()
    .modify((row) => {
      if (row.details)
        row.details.collections = row.details.collections.filter(keep);
    });
  await tx
    .table<HomeRow, string>("home")
    .toCollection()
    .modify((row) => {
      if (row.payload.collections)
        row.payload.collections.items =
          row.payload.collections.items.filter(keep);
    });
}

// Nested snapshots can retain shelf identities after the collection table was refreshed.
async function findRetiredCollectionIds(tx: Transaction): Promise<string[]> {
  const ids = new Set<string>();
  const collect = (row: CollectionIdentity) => {
    if (
      row.kind === "SMART" &&
      row.smartKey !== null &&
      KNOWN_SMART_KEYS.has(row.smartKey)
    )
      ids.add(row.id);
  };
  await tx
    .table<CollectionRow, string>("collections")
    .toCollection()
    .each(collect);
  await tx
    .table<LibraryItemRow, string>("libraryItems")
    .toCollection()
    .each((row) => row.details?.collections.forEach(collect));
  await tx
    .table<HomeRow, string>("home")
    .toCollection()
    .each((row) => row.payload.collections?.items.forEach(collect));
  return [...ids];
}
