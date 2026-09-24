import Dexie from "dexie";
import { createReaderResumeStorageKey } from "@/features/reader/resume";
import { abortSaveAndWait, setStatus } from "../book/bucket";
import { getDb, type AvaReaderDB } from "../../db";
import {
  bumpCompletionRevision,
  COMPLETION_CHANGE_PREFIX,
} from "../../completion/state";
import { DELETED_ITEM_PREFIX } from "./deleted-items";

import { removeCachedHomeItems } from "./remove-cached-home-items";

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
        if (db === getDb())
          setStatus(id, {
            status: "missing",
            currentChapters: 0,
            totalChapters: 0,
          });
      });
      try {
        if (typeof window !== "undefined")
          window.localStorage.removeItem(createReaderResumeStorageKey(id));
      } catch {
        /* storage unavailable */
      }
    }
  });
  const highlightIds = new Set(
    (await db.highlights.where("libraryItemId").anyOf(ids).toArray()).map(
      (row) => row.id,
    ),
  );
  await db.meta.bulkPut(
    ids.map((id) => ({
      key: `${DELETED_ITEM_PREFIX}${id}`,
      value: true,
      updatedAt: new Date().toISOString(),
    })),
  );
  await db.meta.bulkDelete(
    ids.flatMap((id) => [
      `${COMPLETION_CHANGE_PREFIX}${id}`,
      `finish-date-failure:${id}`,
    ]),
  );
  for (const table of [
    db.libraryItems,
    db.books,
    db.progress,
    db.collectionMembershipMutations,
    db.finishDateMutations,
  ]) {
    await table.bulkDelete(ids);
  }
  for (const table of [
    db.collectionMembership,
    db.bookChapters,
    db.translations,
    db.highlights,
    db.aiComments,
  ]) {
    await table.where("libraryItemId").anyOf(ids).delete();
  }
  for (const table of [db.highlightMutations, db.aiCommentMutations]) {
    await table.where("scopeId").anyOf(ids).delete();
  }
  await removeCachedHomeItems(db, removed, highlightIds);
  await bumpCompletionRevision(db);
}
