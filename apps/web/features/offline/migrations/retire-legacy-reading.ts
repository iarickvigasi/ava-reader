import type { Transaction } from "dexie";
import { SESSION_TRACKING_VERSION } from "../buckets/sessions";

type StoredSession = {
  trackingVersion?: number;
  serverSessionId?: string | null;
  syncedAt?: string | null;
  replayStatus?: string;
  dropped?: boolean;
};

// Old pending time is intentionally retired; checkpoint records retain their revisions.
export async function retireLegacyReading(tx: Transaction) {
  const sessions = tx.table<StoredSession, string>("sessions");
  await sessions
    .filter((row) => row.trackingVersion !== SESSION_TRACKING_VERSION)
    .delete();
  await sessions.toCollection().modify((row) => {
    if (row.replayStatus === "dropped") row.dropped = true;
    delete row.serverSessionId;
    delete row.syncedAt;
    delete row.replayStatus;
  });
}
