import { getDb, type CollectionRow } from "../../../db";
import { readProtectedCollections } from "../membership/protected-collections";

export async function replaceCollectionRows(
  collections: CollectionRow[],
  revision: number,
): Promise<Set<string>> {
  const db = getDb();
  const { ids: protectedIds, rows: protectedRows } =
    await readProtectedCollections();
  const next = [
    ...collections
      .filter((row) => !protectedIds.has(row.id))
      .map((row) => ({ ...row, completionRevision: revision })),
    ...protectedRows,
  ];
  const keep = new Set(next.map((row) => row.id));
  const removed = (await db.collections.toArray()).filter(
    (row) => !keep.has(row.id),
  );
  for (const row of removed)
    await db.collectionMembership.where("collectionId").equals(row.id).delete();
  await db.collections.clear();
  await db.collections.bulkPut(next);
  return protectedIds;
}
