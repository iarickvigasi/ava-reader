import type { SessionRow } from "../db";
import type { ReadingCoverageIndex } from "./index-reading-coverage";
import { sessionSpan } from "./session-span";

const MILLISECONDS_PER_SECOND = 1_000;

// Snapshot coverage, rather than upload acknowledgments, determines visible time.
export function uncoveredSessionSpan(
  row: SessionRow,
  coverage: ReadingCoverageIndex,
) {
  if (row.dropped) return null;
  const included = coverage.sessionIds.has(row.clientSessionId);
  const span = sessionSpan(row.startedAt, row.endedAt ?? row.lastHeartbeatAt);
  if (!span) return null;
  const covered = Math.min(
    span.seconds,
    Math.max(
      0,
      coverage.secondsBySession.get(row.clientSessionId) ??
        (included ? span.seconds : 0),
    ),
  );
  return {
    start: span.start + covered * MILLISECONDS_PER_SECOND,
    end: span.end,
    seconds: span.seconds - covered,
  };
}
