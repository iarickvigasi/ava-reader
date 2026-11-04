import type { ReaderProgressPayload } from "@/lib/api-types";
import { getDb, type AvaReaderDB } from "../../db";
import { recordCompletionAck } from "../../completion/state";
import type { ProgressWrite } from "./types";

export async function markProgressSyncedIfUnchanged(
  libraryItemId: string,
  sent: ProgressWrite,
  server: Pick<
    ReaderProgressPayload,
    "locator" | "completionPercent" | "lastReadAt"
  >,
  db: AvaReaderDB = getDb(),
): Promise<boolean> {
  if (db !== getDb()) return false;
  return db.transaction("rw", [db.progress, db.meta], async () => {
    const row = await db.progress.get(libraryItemId);
    if (!row) return false;
    if (
      row.lastLocalUpdateAt !== sent.readAt ||
      row.locator?.chapterId !== sent.locator.chapterId ||
      row.locator?.blockId !== sent.locator.blockId ||
      row.locator?.textOffset !== sent.locator.textOffset
    )
      return false;
    await recordCompletionAck(db, libraryItemId, {
      completionPercent: server.completionPercent,
    });
    await db.progress.put({
      ...row,
      ...server,
      lastServerUpdateAt: new Date().toISOString(),
      dirty: false,
    });
    return true;
  });
}
