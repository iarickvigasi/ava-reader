import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { getDb, type AvaReaderDB } from "../../../db";
import { isLibraryItemDeleted } from "../deleted-items";
import { mergePdfImportStatus } from "./merge-status";

export async function applyPdfImportStatus(
  db: AvaReaderDB,
  status: PdfImportSummary,
) {
  if (db !== getDb()) return false;
  return db
    .transaction("rw", [db.libraryItems, db.meta], async () => {
      if (
        db !== getDb() ||
        (await isLibraryItemDeleted(db, status.libraryItemId))
      )
        return false;
      const row = await db.libraryItems.get(status.libraryItemId);
      if (!row) return false;
      const pdfImport = mergePdfImportStatus(row.pdfImport, status);
      if (pdfImport === row.pdfImport) return false;
      await db.libraryItems.update(row.libraryItemId, { pdfImport });
      return row.pdfImport?.status !== pdfImport?.status;
    })
    .catch((error: unknown) => {
      if (db !== getDb()) return false;
      throw error;
    });
}
