import { getDb } from "../../../db";
import { markFinishDateChange } from "./runtime";
import { clearFinishDateFailure } from "./failure-store";
import { writeFinishDateRevision } from "./revision";
import { flushFinishDates } from "./sync";
import type { GetToken } from "./types";
import { bumpCompletionRevision } from "../../../completion/state";

// Queue the explicit value, including null, so retries never change the tap's
// date and an undo made while the first request is in flight is not lost.
export async function setBookFinishedAt(
  libraryItemId: string,
  finishedAt: string | null,
  getToken: GetToken,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.libraryItems, db.finishDateMutations, db.meta], async () => {
    const book = await db.libraryItems.get(libraryItemId);
    if (!book?.details) throw new Error("Book details are unavailable.");
    const prior = await db.finishDateMutations.get(libraryItemId);
    await db.finishDateMutations.put({
      libraryItemId, finishedAt,
      revision: crypto.randomUUID(),
      queuedAt: prior?.queuedAt ?? new Date().toISOString(),
    });
    await clearFinishDateFailure(db, libraryItemId);
    await writeFinishDateRevision(db);
    await bumpCompletionRevision(db);
  });
  if (db !== getDb()) return;
  markFinishDateChange();
  void flushFinishDates(getToken);
}
