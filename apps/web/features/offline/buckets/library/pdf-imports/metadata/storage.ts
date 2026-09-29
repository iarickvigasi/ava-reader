import type { PdfMetadata } from "@/lib/api-types/pdf-metadata";
import { getDb, type AvaReaderDB } from "../../../../db";
import { isLibraryItemDeleted } from "../../deleted-items";
import { keepPriorMetadata } from "./version";

export async function applyPdfMetadata(db: AvaReaderDB, metadata: PdfMetadata) {
  if (db !== getDb()) return false;
  return db.transaction(
    "rw",
    [db.libraryItems, db.books, db.meta],
    async () => {
      if (
        db !== getDb() ||
        (await isLibraryItemDeleted(db, metadata.libraryItemId))
      )
        return false;
      const row = await db.libraryItems.get(metadata.libraryItemId);
      if (
        !row ||
        row.pdfImport?.operationId !== metadata.operationId ||
        keepPriorMetadata(row.metadataEditVersion, metadata.metadataEditVersion)
      )
        return false;
      await db.libraryItems.put({
        ...row,
        title: metadata.title,
        authors: metadata.authors,
        metadataEditVersion: metadata.metadataEditVersion,
        ...(row.details
          ? { details: { ...row.details, language: metadata.language } }
          : {}),
      });
      const cached = await db.books.get(metadata.libraryItemId);
      // Display metadata is mutable; accepted canonical source and bytes stay fixed.
      if (cached && cached.metadata && typeof cached.metadata === "object")
        await db.books.put({
          ...cached,
          metadata: {
            ...cached.metadata,
            title: metadata.title,
            authors: metadata.authors,
            language: metadata.language,
          },
        });
      return true;
    },
  );
}
