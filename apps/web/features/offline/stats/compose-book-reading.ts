import type { BookReadingSnapshot } from "@/lib/api-types/reading-coverage";
import type { SessionRow } from "../db";
import { indexReadingCoverage } from "./index-reading-coverage";
import { uncoveredSessionSpan } from "./uncovered-session-span";

export function composeBookReading(
  baselineMinutes: number,
  sessions: SessionRow[],
  snapshot?: BookReadingSnapshot,
) {
  const coverage = indexReadingCoverage(snapshot ?? { clientSessionIds: [] });
  let seconds = snapshot?.totalSeconds ?? baselineMinutes * 60;
  for (const session of sessions)
    seconds += uncoveredSessionSpan(session, coverage)?.seconds ?? 0;
  return Math.floor(seconds / 60);
}
