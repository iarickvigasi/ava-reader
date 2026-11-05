import type { SessionRow } from "./types";

export function needsSessionSync(row: SessionRow): boolean {
  return !row.dropped && row.revision > row.acknowledgedRevision;
}
