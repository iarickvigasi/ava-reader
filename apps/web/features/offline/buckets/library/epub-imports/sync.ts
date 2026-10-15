import { getDb } from "../../../db";
import { revalidateBookInfo } from "../revalidate";
import { revalidateHome } from "../../home";
import { epubDetailsRevision } from "./merge-status";

// Reuse the app's visibility/online observer and identity-fenced bucket writes.
// Rotate a bounded batch so a stalled book cannot starve later imports.
const cursors = new WeakMap<object, number>();
export async function observeEpubImports(
  getToken: () => Promise<string | null>,
) {
  const db = getDb();
  const rows = (await db.libraryItems.toArray()).filter(
    (row) =>
      row.epubImport &&
      (!["READY", "FAILED"].includes(row.epubImport.status) ||
        (row.details &&
          row.epubDetailsRevision !== epubDetailsRevision(row.epubImport))),
  );
  if (!rows.length || db !== getDb()) return false;
  const start = (cursors.get(db) ?? 0) % rows.length;
  const batch = [...rows.slice(start), ...rows.slice(0, start)].slice(0, 10);
  cursors.set(db, start + batch.length);
  for (const row of batch) {
    if (db !== getDb()) return false;
    await revalidateBookInfo(row.slug, getToken);
  }
  if (db !== getDb()) return false;
  const changed = (
    await Promise.all(
      batch.map(
        async (row) =>
          epubDetailsRevision(
            (await db.libraryItems.get(row.libraryItemId))?.epubImport,
          ) !== epubDetailsRevision(row.epubImport),
      ),
    )
  ).some(Boolean);
  if (changed && db === getDb()) await revalidateHome(getToken);
  return true;
}
