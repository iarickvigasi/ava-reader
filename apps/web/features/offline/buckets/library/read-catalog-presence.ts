import { getDb } from "../../db";
import { isLibraryItemDeleted } from "./deleted-items";

export async function readCatalogPresence(
  entryId: string,
  initialId?: string | null,
) {
  const db = getDb();
  const cached = (await db.meta.get(`catalog-reading-copy:${entryId}`))
    ?.value as { libraryItemId: string } | undefined;
  for (const id of new Set([cached?.libraryItemId, initialId])) {
    if (!id || (await isLibraryItemDeleted(db, id))) continue;
    if ((await db.libraryItems.get(id)) || id === initialId) return true;
  }
  return false;
}
