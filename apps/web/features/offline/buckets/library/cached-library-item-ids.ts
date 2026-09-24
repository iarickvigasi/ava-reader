import type { AvaReaderDB } from "../../db";

// Also finds old orphans whose library row was already removed by an older client.
export async function cachedLibraryItemIds(db: AvaReaderDB): Promise<string[]> {
  // Safari can reject nextunique cursors on empty indexes. Read ordinary keys
  // and deduplicate here, including IDs shared across stores.
  const ids = new Set<string>();
  for (const table of [
    db.libraryItems,
    db.books,
    db.progress,
    db.collectionMembershipMutations,
    db.finishDateMutations,
  ]) {
    for (const id of await table.toCollection().primaryKeys()) ids.add(id);
  }
  for (const table of [
    db.bookChapters,
    db.translations,
    db.highlights,
    db.aiComments,
    db.collectionMembership,
  ]) {
    for (const id of await table.orderBy("libraryItemId").keys())
      ids.add(String(id));
  }
  for (const table of [db.highlightMutations, db.aiCommentMutations]) {
    for (const id of await table.orderBy("scopeId").keys()) ids.add(String(id));
  }
  return [...ids];
}
