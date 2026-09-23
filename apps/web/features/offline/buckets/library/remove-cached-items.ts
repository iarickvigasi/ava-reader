import Dexie from "dexie";
import { createReaderResumeStorageKey } from "@/features/reader/resume";
import { abortSaveAndWait, setStatus } from "../book/bucket";
import { getDb, type AvaReaderDB } from "../../db";
import { bumpCompletionRevision, COMPLETION_CHANGE_PREFIX } from "../../completion/state";
import { DELETED_ITEM_PREFIX } from "./deleted-items";

export function removalTables(db: AvaReaderDB) {
  return [db.libraryItems, db.collectionMembership, db.collectionMembershipMutations,
    db.finishDateMutations, db.books, db.bookChapters, db.translations, db.highlights,
    db.aiComments, db.progress, db.highlightMutations, db.aiCommentMutations, db.meta, db.home];
}

// Also finds old orphans whose library row was already removed by an older client.
export async function cachedLibraryItemIds(db: AvaReaderDB): Promise<string[]> {
  const ids = new Set<string>();
  for (const table of [db.libraryItems, db.books, db.progress, db.collectionMembershipMutations, db.finishDateMutations]) {
    for (const id of await table.toCollection().primaryKeys()) ids.add(id);
  }
  for (const table of [db.bookChapters, db.translations, db.highlights, db.aiComments, db.collectionMembership]) {
    for (const id of await table.orderBy("libraryItemId").uniqueKeys()) ids.add(String(id));
  }
  for (const table of [db.highlightMutations, db.aiCommentMutations]) {
    for (const id of await table.orderBy("scopeId").uniqueKeys()) ids.add(String(id));
  }
  return [...ids];
}

// Caller owns the transaction. Sessions and session replay queues deliberately
// survive: historical reading time belongs to the user, not the cached book.
export async function removeCachedItemsTx(db: AvaReaderDB, ids: string[]) {
  if (!ids.length) return;
  const removed = new Set(ids);
  // Only cancel downloads / clear synchronous resume hints after commit.
  Dexie.currentTransaction?.on("complete", () => {
    if (db !== getDb()) return;
    for (const id of ids) {
      void abortSaveAndWait(id).then(() => {
        if (db === getDb()) setStatus(id, { status: "missing", currentChapters: 0, totalChapters: 0 });
      });
      try { if (typeof window !== "undefined") window.localStorage.removeItem(createReaderResumeStorageKey(id)); } catch { /* storage unavailable */ }
    }
  });
  const highlightIds = new Set((await db.highlights.where("libraryItemId").anyOf(ids).toArray()).map(row => row.id));
  await db.meta.bulkPut(ids.map(id => ({ key: `${DELETED_ITEM_PREFIX}${id}`, value: true, updatedAt: new Date().toISOString() })));
  await db.meta.bulkDelete(ids.flatMap(id => [`${COMPLETION_CHANGE_PREFIX}${id}`, `finish-date-failure:${id}`]));
  for (const table of [db.libraryItems, db.books, db.progress, db.collectionMembershipMutations, db.finishDateMutations]) {
    await table.bulkDelete(ids);
  }
  for (const table of [db.collectionMembership, db.bookChapters, db.translations, db.highlights, db.aiComments]) {
    await table.where("libraryItemId").anyOf(ids).delete();
  }
  for (const table of [db.highlightMutations, db.aiCommentMutations]) {
    await table.where("scopeId").anyOf(ids).delete();
  }
  const home = await db.home.get("me");
  if (home) await db.home.put({ ...home, payload: {
    ...home.payload,
    currentEngagement: home.payload.currentEngagement && removed.has(home.payload.currentEngagement.libraryItemId) ? null : home.payload.currentEngagement,
    completionItems: home.payload.completionItems?.filter(item => !removed.has(item.libraryItemId)),
    recentAnnotations: { items: home.payload.recentAnnotations.items.filter(item => !highlightIds.has(item.id)) },
    collections: { items: home.payload.collections.items.map(collection => ({ ...collection,
      completionItems: collection.completionItems?.filter(item => !removed.has(item.libraryItemId)),
    })) },
  } });
  await bumpCompletionRevision(db);
}

export async function removeCachedLibraryItems(ids: string[], db = getDb()) {
  if (db !== getDb()) return;
  await db.transaction("rw", removalTables(db), () => removeCachedItemsTx(db, ids));
}
