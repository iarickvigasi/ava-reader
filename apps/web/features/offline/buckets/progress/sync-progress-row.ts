import { withDeadline } from "@/features/auth/with-deadline";
import { getDb, type AvaReaderDB, type ProgressRow } from "../../db";
import { markProgressSyncedIfUnchanged } from "./acknowledge-progress";
import { postProgress } from "./post-progress";
import type { GetProgressToken, ProgressSyncOptions } from "./types";

export async function syncProgressRow(
  db: AvaReaderDB,
  row: ProgressRow,
  getToken: GetProgressToken,
  options: ProgressSyncOptions = {},
) {
  if (!row.dirty || !row.locator) return null;
  const write = { locator: row.locator, readAt: row.lastLocalUpdateAt };
  const token = await withDeadline(getToken());
  if (!token || db !== getDb()) return null;
  const server = await postProgress(token, row.libraryItemId, write, options);
  const applied = await markProgressSyncedIfUnchanged(
    row.libraryItemId,
    write,
    server,
    db,
  );
  return applied ? server : null;
}
