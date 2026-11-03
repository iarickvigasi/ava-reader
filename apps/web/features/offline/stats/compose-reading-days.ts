import type { ReadingCoverage } from "@/lib/api-types/reading-coverage";
import type { ReadingDaySource } from "@/lib/api-types/reading-day-source";
import type { SessionRow } from "../db";
import { indexReadingCoverage } from "./index-reading-coverage";
import { readingSnapshotDays } from "./reading-snapshot";
import { uncoveredSessionDays } from "./uncovered-session-days";

export function composeReadingDays(
  snapshot: ReadingDaySource & ReadingCoverage,
  sessions: SessionRow[],
) {
  const coverage = indexReadingCoverage(snapshot);
  const dailySeconds = readingSnapshotDays(snapshot);
  let extraSeconds = 0;
  for (const session of sessions) {
    for (const [day, seconds] of uncoveredSessionDays(session, coverage)) {
      extraSeconds += seconds;
      dailySeconds.set(day, (dailySeconds.get(day) ?? 0) + seconds);
    }
  }
  return { dailySeconds, extraSeconds };
}
