import type { AvaReaderDB } from "../../db";
import { updateSession } from "./update-session";
import type { CheckpointAck, SessionRow } from "./types";

export function acknowledgeCheckpoint(
  db: AvaReaderDB,
  sent: SessionRow,
  ack: CheckpointAck,
) {
  return updateSession(db, sent.clientSessionId, (row) => ({
    ...row,
    acknowledgedRevision: Math.max(
      row.acknowledgedRevision,
      Math.min(sent.revision, ack.revision),
    ),
  }));
}
