import type { SessionRow } from "../db";
import type { ReadingCoverageIndex } from "./index-reading-coverage";
import { splitReadingDays } from "./reading-days";
import { uncoveredSessionSpan } from "./uncovered-session-span";

export function uncoveredSessionDays(
  row: SessionRow,
  coverage: ReadingCoverageIndex,
) {
  const span = uncoveredSessionSpan(row, coverage);
  return span
    ? splitReadingDays(span.start, span.end, row.timeZone)
    : new Map<string, number>();
}
