import { mergePdfImportStatus } from "../pdf-imports/merge-status";
import { keepPriorMetadata } from "../pdf-imports/metadata/version";
import { isLibraryItemDeleted } from "../deleted-items";

import type { LibraryBookInfo } from "@/lib/api-types/library";

import { getDb, type AvaReaderDB, type LibraryItemRow } from "../../../db";
import { readFinishDateRevision } from "../finish-date/revision";

export type BookInfoWriteOptions = {
  db?: AvaReaderDB;
  seedOnly?: boolean;
  expectedFinishDateRevision?: string | null;
};

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
      if (
        db !== getDb() ||
        (await isLibraryItemDeleted(db, book.libraryItemId))
      )
        return;
      const prior = await db.libraryItems.get(book.libraryItemId);
      const keepMetadata =
        prior &&
        keepPriorMetadata(prior.metadataEditVersion, book.metadataEditVersion);
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
      const next: LibraryItemRow = {
        libraryItemId: book.libraryItemId,
        slug: book.slug,
        title: keepMetadata ? prior.title : book.title,
        authors: keepMetadata ? prior.authors : book.authors,
        metadataEditVersion: keepMetadata
          ? prior.metadataEditVersion
          : book.metadataEditVersion,
        coverImageUrl: book.coverImageUrl,
        completionPercent: book.completionPercent,
        finishedAt,
        primaryFormat: book.primaryFormat,
        pdfImport: mergePdfImportStatus(prior?.pdfImport, book.pdfImport),
        lastReadAt: book.lastReadAt ?? prior?.lastReadAt ?? null,
        coverBlob: prior?.coverBlob ?? null,
        savedOffline: prior?.savedOffline ?? false,
        savedAutomatically: prior?.savedAutomatically ?? false,
        savedAt: prior?.savedAt ?? null,
        offlineRequested: prior?.offlineRequestedDirty
          ? (prior.offlineRequested ?? false)
          : (book.offlineRequested ?? prior?.offlineRequested ?? false),
        offlineRequestedDirty: prior?.offlineRequestedDirty ?? false,
        offlineRequestedBaseline:
          book.offlineRequested ?? prior?.offlineRequestedBaseline ?? false,
        serverUpdatedAt: prior?.serverUpdatedAt ?? nowIso,
        details: {
          addedAt: book.addedAt,
          approximateBodyPageCount: book.approximateBodyPageCount ?? null,
          approximatePageCount: book.approximatePageCount,
          chapterLabel: book.chapterLabel,
          collections:
            pending && prior?.details
              ? prior.details.collections
              : book.collections,
          description: book.description,
          genres: book.genres,
          finishedAt,
          language:
            keepMetadata && prior.details
              ? prior.details.language
              : book.language,
          lastReadAt: book.lastReadAt,
          minutesRead: book.minutesRead,
          publishedYear: book.publishedYear,
          source: book.source,
        },
        detailsFetchedAt: nowIso,
      };
      await db.libraryItems.put(next);
    },
  );
}
