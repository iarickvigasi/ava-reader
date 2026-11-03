import type { SessionRow } from "./types";

export function sealSession(
  row: SessionRow,
  at = row.lastHeartbeatAt,
): SessionRow {
  return {
    ...row,
    state: "closed",
    endedAt: at,
    lastHeartbeatAt: at,
    revision: row.revision + 1,
  };
}
