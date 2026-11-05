import { SESSION_SYNC_STATE } from "./constants";
import { needsSessionSync } from "./needs-session-sync";
import type { SessionRow } from "./types";

export function sessionSyncState(row: SessionRow) {
  return row.dropped
    ? SESSION_SYNC_STATE.dropped
    : needsSessionSync(row)
      ? SESSION_SYNC_STATE.pending
      : SESSION_SYNC_STATE.acknowledged;
}
