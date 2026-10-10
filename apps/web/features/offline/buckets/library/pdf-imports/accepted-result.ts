import { getDb, type AvaReaderDB } from "../../../db";
import { isLibraryItemDeleted } from "../deleted-items";
import type { ImportResult } from "./types";

export async function acceptedPdfImportResult(
  db: AvaReaderDB,
  state: "accepted" | "existing",
  libraryItemId: string,
): Promise<ImportResult> {
  if (db !== getDb()) return { state: "uncertain" };
  const row = await db.libraryItems.get(libraryItemId);
  const deleted = await isLibraryItemDeleted(db, libraryItemId);
  if (db !== getDb() || deleted) return { state: "uncertain" };
  // Receipt IDs are storage identity; only the owned Library row defines its URL.
  return { state, libraryItemId, ...(row?.slug ? { slug: row.slug } : {}) };
}
