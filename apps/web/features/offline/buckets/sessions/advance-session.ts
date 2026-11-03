import { SESSION_MAX_DURATION_MS, SESSION_MAX_GAP_MS } from "./constants";
import { sealSession } from "./seal-session";
import type { ReadingTick, SessionRow } from "./types";

export function advanceSession(
  row: SessionRow,
  tick: ReadingTick,
  stop: boolean,
): SessionRow {
  const at = tick.interrupted
    ? row.lastHeartbeatAt
    : new Date(Date.parse(row.lastHeartbeatAt) + tick.elapsedMs).toISOString();
  const duration = Date.parse(at) - Date.parse(row.startedAt);
  const close =
    stop ||
    tick.interrupted ||
    duration >= SESSION_MAX_DURATION_MS - SESSION_MAX_GAP_MS;
  return close
    ? sealSession(row, at)
    : {
        ...row,
        lastHeartbeatAt: at,
        revision: row.revision + 1,
      };
}
