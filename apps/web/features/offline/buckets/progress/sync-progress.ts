import { getDb } from "../../db";
import { syncProgressRow } from "./sync-progress-row";
import type { GetProgressToken, ProgressSyncOptions } from "./types";

export async function syncProgress(
  libraryItemId: string,
  getToken: GetProgressToken,
  options?: ProgressSyncOptions,
) {
  const db = getDb();
  const row = await db.progress.get(libraryItemId);
  return row ? syncProgressRow(db, row, getToken, options) : null;
}
