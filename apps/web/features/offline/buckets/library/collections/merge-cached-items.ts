import { getDb, type AvaReaderDB, type LibraryItemRow } from "../../../db";
import { isLibraryItemDeleted } from "../deleted-items";
import {
  COMPLETION_CHANGE_PREFIX,
  type CompletionChange,
} from "../../../completion/state";
import { mergeListPayloadItemRow } from "./item-row";

// Layers each payload row onto the cached one it replaces. Preserves the
// offline-save metadata a server payload doesn't carry: without this, a
// re-hydration stomps a book the user marked savedOffline.
export async function mergeOntoCachedTx(
  rows: LibraryItemRow[],
  db: AvaReaderDB = getDb(),
  revision = 0,
): Promise<LibraryItemRow[]> {
  const retained = [];
  for (const row of rows) {
    if (!(await isLibraryItemDeleted(db, row.libraryItemId)))
      retained.push(row);
  }
  rows = retained;
  const cached = await db.libraryItems
    .where("libraryItemId")
    .anyOf(rows.map((row) => row.libraryItemId))
    .toArray();
  const cachedById = new Map(cached.map((row) => [row.libraryItemId, row]));
  return Promise.all(
    rows.map(async (row) => {
      const change = (
        await db.meta.get(`${COMPLETION_CHANGE_PREFIX}${row.libraryItemId}`)
      )?.value as CompletionChange | undefined;
      const next = {
        ...row,
        ...(change?.finishedAt && change.finishedAt.revision > revision
          ? { finishedAt: change.finishedAt.value }
          : {}),
        ...(change?.completionPercent &&
        change.completionPercent.revision > revision
          ? { completionPercent: change.completionPercent.value }
          : {}),
      };
      return mergeListPayloadItemRow(next, cachedById.get(row.libraryItemId));
    }),
  );
}
