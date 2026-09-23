import type { Table } from "dexie";
import { getDb, type AvaReaderDB } from "../../db";

export const DELETED_ITEM_PREFIX = "deleted-library-item:";
export async function isLibraryItemDeleted(db: AvaReaderDB, id: string) {
  return Boolean(await db.meta.get(`${DELETED_ITEM_PREFIX}${id}`));
}

// Fence late responses and other tabs in the SAME transaction as their write.
export async function writeUnlessDeleted<T>(db: AvaReaderDB, id: string, tables: Table[], write: () => Promise<T>) {
  return db.transaction("rw", [...tables, db.meta], async () => {
    if (db !== getDb() || await isLibraryItemDeleted(db, id)) return;
    return write();
  });
}
