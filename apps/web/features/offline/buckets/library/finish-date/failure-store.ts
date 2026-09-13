import type { AvaReaderDB } from "../../../db";
import type { FinishDateSyncFailure } from "./types";

const FAILURE_KEY_PREFIX = "finish-date-failure:";

export type StoredFinishDateSyncFailure = FinishDateSyncFailure & { revision: string };

// These helpers join the caller's transaction so rejecting a queued change
// and recording its error cannot leave other tabs with an unexplained revert.
export async function writeFinishDateFailure(
  db: AvaReaderDB,
  event: StoredFinishDateSyncFailure,
): Promise<void> {
  await db.meta.put({
    key: `${FAILURE_KEY_PREFIX}${event.libraryItemId}`,
    value: event,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearFinishDateFailure(
  db: AvaReaderDB,
  libraryItemId: string,
): Promise<void> {
  await db.meta.delete(`${FAILURE_KEY_PREFIX}${libraryItemId}`);
}

export async function readFinishDateFailures(
  db: AvaReaderDB,
): Promise<StoredFinishDateSyncFailure[]> {
  const rows = await db.meta.where("key").startsWith(FAILURE_KEY_PREFIX).toArray();
  return rows.flatMap((row) => {
    const event = row.value as Partial<StoredFinishDateSyncFailure> | null;
    if (!event || typeof event.libraryItemId !== "string" ||
      typeof event.reason !== "string" || typeof event.revision !== "string" ||
      row.key !== `${FAILURE_KEY_PREFIX}${event.libraryItemId}`) return [];
    return [event as StoredFinishDateSyncFailure];
  });
}
