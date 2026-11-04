import type { Transaction } from "dexie";
import { sessionSyncState } from "../buckets/sessions/session-sync-state";
import type { SessionRow } from "../buckets/sessions/types";

export async function indexPendingSessions(tx: Transaction) {
  await tx
    .table<SessionRow, string>("sessions")
    .toCollection()
    .modify((row) => {
      row.syncState = sessionSyncState(row);
    });
}
