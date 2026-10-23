import Dexie from "dexie";
import { getDb, type AvaReaderDB } from "../../../db";
import { writeUnlessDeleted } from "../../library/deleted-items";
import { resolveApiAssetUrl } from "@/lib/api";
import { forgetWarmCover } from "../warm-cover";
import { encodeCover } from "./encode";
import { isValidCover } from "./validate";

export async function attachCoverBlob(
  libraryItemId: string,
  blob: Blob | null,
  sourceUrl?: string,
  db: AvaReaderDB = getDb(),
): Promise<void> {
  const item = await db.libraryItems.get(libraryItemId);
  if (!item || db !== getDb()) return;
  if (
    sourceUrl &&
    resolveApiAssetUrl(item.coverImageUrl) !== resolveApiAssetUrl(sourceUrl)
  )
    return;
  const next = blob
    ? await encodeCover(blob, {
        libraryItemId,
        sourceUrl: item.coverImageUrl,
        verified: true,
      })
    : null;
  let changed = false;
  await writeUnlessDeleted(
    db,
    libraryItemId,
    [db.libraryItems, db.bookCovers],
    async () => {
      const currentItem = await db.libraryItems.get(libraryItemId);
      if (!currentItem || currentItem.coverImageUrl !== item.coverImageUrl)
        return;
      const current = await db.bookCovers.get(libraryItemId);
      if (
        next &&
        current?.verified &&
        current.sourceUrl === next.sourceUrl &&
        (await Dexie.waitFor(isValidCover(current)))
      )
        return;
      changed = true;
      if (next) await db.bookCovers.put(next);
      else await db.bookCovers.delete(libraryItemId);
    },
  );
  if (db === getDb() && changed) forgetWarmCover(libraryItemId);
}
