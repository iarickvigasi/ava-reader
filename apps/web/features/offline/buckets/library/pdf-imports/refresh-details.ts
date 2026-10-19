import { getDb, type AvaReaderDB } from "../../../db";
import { isLibraryItemDeleted } from "../deleted-items";
import { revalidateBookInfo } from "../revalidate";
import { pdfDetailsRevision } from "./details-revision";
import type { GetToken } from "./types";

export async function refreshPdfDetails(db: AvaReaderDB, getToken: GetToken) {
  if (db !== getDb()) return false;
  const stale = (await db.libraryItems.toArray()).filter(
    (row) =>
      row.pdfImport &&
      row.details &&
      row.pdfDetailsRevision !== pdfDetailsRevision(row),
  );
  for (const row of stale.slice(0, 20)) {
    if (db !== getDb()) return false;
    if (await isLibraryItemDeleted(db, row.libraryItemId)) continue;
    // Only a successful, current details payload advances the stored revision.
    // An interrupted fetch remains stale and is retried by the next observation.
    await revalidateBookInfo(row.slug, getToken);
  }
  return stale.length > 0;
}
