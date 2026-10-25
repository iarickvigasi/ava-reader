import {
  removalTables,
  cachedLibraryItemIds,
  removeCachedItemsTx,
} from "../remove-cached-items";
import { isLibraryItemDeleted } from "../deleted-items";
import type { LibraryPayload } from "@/lib/api-types/library";

import { mergeOntoCachedTx } from "./merge-cached-items";
import { collectPayloadRows } from "./payload-rows";
import { replacePreviewMembershipTx } from "./preview-membership";
import { writeLibraryBooksCountTx } from "./summary-store";

import { writeCatalogIds } from "./catalog-store";
import { getDb } from "../../../db";
import { replaceCollectionRows } from "./replace-collection-rows";
import {
  readCompletionRevision,
  type CompletionWriteOptions,
} from "../../../completion/state";

export type LibraryWriteOptions = CompletionWriteOptions & {
  canRemove?: boolean;
  // Only sweep IDs already cached when the request began. A concurrent import
  // may hydrate a new book after the server took its snapshot.
  removalCandidates?: string[];
};

// Refresh previews and cascade missing identities only when the server supplies
// a complete identity set. Reading sessions always survive deletion.
export async function applyLibraryPayload(
  payload: LibraryPayload,
  options: LibraryWriteOptions = {},
) {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  const { collections, items, memberships } = collectPayloadRows(
    payload,
    new Date().toISOString(),
  );

  await db.transaction(
    "rw",
    [...removalTables(db), db.collections],
    async () => {
      if (
        options.expectedCompletionRevision !== undefined &&
        options.expectedCompletionRevision !==
          (await readCompletionRevision(db))
      )
        return;
      // Reject a snapshot taken before a locally known deletion, including its counts.
      for (const id of payload.libraryItemIds ??
        items.map((item) => item.libraryItemId)) {
        if (await isLibraryItemDeleted(db, id)) return;
      }
      const nextItems = await mergeOntoCachedTx(
        items,
        db,
        options.expectedCompletionRevision ?? 0,
      );
      const protectedIds = await replaceCollectionRows(
        collections,
        options.expectedCompletionRevision ?? 0,
      );

      await db.libraryItems.bulkPut(nextItems);
      await replacePreviewMembershipTx(
        {
          ...payload,
          collections: payload.collections.filter(
            (collection) => !protectedIds.has(collection.id),
          ),
        },
        memberships,
      );
      await writeLibraryBooksCountTx(payload.summary.booksCount);
      if (payload.books !== undefined)
        await writeCatalogIds(payload.books.map((book) => book.libraryItemId));
      if (options.canRemove !== false && payload.libraryItemIds !== undefined) {
        const keep = new Set(payload.libraryItemIds);
        const candidates =
          options.removalCandidates ?? (await cachedLibraryItemIds(db));
        const removed = candidates.filter((id) => !keep.has(id));
        await removeCachedItemsTx(db, removed);
      }
    },
  );
}
