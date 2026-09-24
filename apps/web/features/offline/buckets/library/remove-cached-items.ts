import { getDb, type AvaReaderDB } from "../../db";
import { removeCachedItemsTx } from "./remove-cached-items-tx";

export { cachedLibraryItemIds } from "./cached-library-item-ids";
export { removeCachedItemsTx } from "./remove-cached-items-tx";

export function removalTables(db: AvaReaderDB) {
  return [
    db.libraryItems,
    db.collectionMembership,
    db.collectionMembershipMutations,
    db.finishDateMutations,
    db.books,
    db.bookChapters,
    db.translations,
    db.highlights,
    db.aiComments,
    db.progress,
    db.highlightMutations,
    db.aiCommentMutations,
    db.meta,
    db.home,
  ];
}

export async function removeCachedLibraryItems(ids: string[], db = getDb()) {
  if (db !== getDb()) return;
  await db.transaction("rw", removalTables(db), () =>
    removeCachedItemsTx(db, ids),
  );
}
