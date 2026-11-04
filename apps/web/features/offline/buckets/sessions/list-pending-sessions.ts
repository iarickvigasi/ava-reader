import { SESSION_SYNC_STATE } from "./constants";
import { getDb } from "../../db";

export function listPendingSessions(db = getDb()) {
  return db.sessions
    .where("syncState")
    .equals(SESSION_SYNC_STATE.pending)
    .toArray();
}
