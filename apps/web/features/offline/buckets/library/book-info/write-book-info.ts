import { buildBookInfoRow } from "./build-book-info-row";
import { isLibraryItemDeleted } from "../deleted-items";
// The book-info page's cache: the detail fields the library/collection
// payloads don't carry, layered onto the row they already wrote. Cached so the
// page works offline once the user has visited it online at least once.

import type { LibraryBookInfo } from "@/lib/api-types/library";

import { getDb, type AvaReaderDB } from "../../../db";
import { readFinishDateRevision } from "../finish-date/revision";

export type BookInfoWriteOptions = {
  db?: AvaReaderDB;
  seedOnly?: boolean;
  expectedFinishDateRevision?: string | null;
};

// Writes the full LibraryBookInfo into the row identified by libraryItemId.
// Used by the book-info page hydrator after either of its server fetches.
export async function applyBookInfoPayload(
  book: LibraryBookInfo,
  options: BookInfoWriteOptions = {},
): Promise<void> {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  const nowIso = new Date().toISOString();
  await db.transaction(
    "rw",
    [
      db.libraryItems,
      db.collectionMembershipMutations,
      db.finishDateMutations,
      db.meta,
    ],
    async () => {
      if (
        options.expectedFinishDateRevision !== undefined &&
        options.expectedFinishDateRevision !==
          (await readFinishDateRevision(db))
      )
        return;
      if (await isLibraryItemDeleted(db, book.libraryItemId)) return;
      const prior = await db.libraryItems.get(book.libraryItemId);
      if (options.seedOnly && prior?.details) return;
      const pending = await db.collectionMembershipMutations.get(
        book.libraryItemId,
      );
      const pendingFinishDate = await db.finishDateMutations.get(
        book.libraryItemId,
      );
      const finishedAt = pendingFinishDate
        ? prior?.finishedAt !== undefined
          ? prior.finishedAt
          : (prior?.details?.finishedAt ?? null)
        : (book.finishedAt ?? null);
      await db.libraryItems.put(
        buildBookInfoRow({
          book,
          prior,
          finishedAt,
          retainCollections: Boolean(pending),
          nowIso,
        }),
      );
    },
  );
}
