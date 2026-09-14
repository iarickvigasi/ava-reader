import { getDb, type AvaReaderDB } from "../../../db";
import { markFinishDateChange } from "./runtime";
import { clearFinishDateFailure, writeFinishDateFailure } from "./failure-store";
import { writeFinishDateRevision } from "./revision";
import type { FinishDateMutation } from "./types";
import { bumpCompletionRevision, recordCompletionAck } from "../../../completion/state";

// Canonical value and queue acknowledgment move together. A newer edit stays
// overlaid, even when it reverses the request currently being acknowledged.
export async function acknowledgeFinishDate(
  db: AvaReaderDB,
  sent: FinishDateMutation,
  finishedAt?: string | null,
  failureReason?: string,
): Promise<boolean> {
  if (db !== getDb()) return false;
  markFinishDateChange();
  const removed = await db.transaction("rw", [db.libraryItems, db.finishDateMutations, db.meta], async () => {
    await writeFinishDateRevision(db);
    if (finishedAt !== undefined) {
      await db.libraryItems.update(sent.libraryItemId, { finishedAt, "details.finishedAt": finishedAt });
      await recordCompletionAck(db, sent.libraryItemId, { finishedAt });
    } else await bumpCompletionRevision(db);
    const pending = await db.finishDateMutations.get(sent.libraryItemId);
    if (pending?.revision !== sent.revision) return false;
    if (failureReason !== undefined) {
      await writeFinishDateFailure(db, { libraryItemId: sent.libraryItemId, revision: sent.revision, reason: failureReason });
    } else {
      await clearFinishDateFailure(db, sent.libraryItemId);
    }
    await db.finishDateMutations.delete(sent.libraryItemId);
    return true;
  });
  markFinishDateChange();
  return removed;
}
