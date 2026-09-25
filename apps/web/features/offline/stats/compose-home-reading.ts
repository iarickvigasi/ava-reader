import { deviceTimeZone } from "./device-time-zone";
import { dayKey } from "./reading-days";
import { readingSnapshotDays } from "./reading-snapshot";
import type { HomePayload } from "@/lib/api-types/home";
import type { SessionRow } from "../db";
import { composeMastery } from "./compose-mastery";
import { splitSessionDays } from "./split-session-days";

const SECONDS_PER_HOUR = 3600;

// Called with the raw home row and sessions from the same Dexie transaction.
// Upload state controls retries; snapshot membership controls displayed time.
export function composeHomeReading(
  home: HomePayload,
  sessions: SessionRow[],
  timeZone = deviceTimeZone(),
): HomePayload {
  const snapshot = home.readingSnapshot;
  if (!snapshot) return home;
  const included = new Set(snapshot.clientSessionIds);
  const dailySeconds = readingSnapshotDays(snapshot);
  let totalSeconds = snapshot.totalSeconds;
  for (const row of sessions) {
    if (
      row.state !== "closed" ||
      !row.endedAt ||
      row.replayStatus === "dropped" ||
      included.has(row.clientSessionId) ||
      (row.syncedAt !== null && row.replayStatus !== "acknowledged")
    )
      continue;
    for (const [day, seconds] of splitSessionDays(
      row.startedAt,
      row.endedAt,
      row.timeZone ?? "UTC",
    )) {
      totalSeconds += seconds;
      dailySeconds.set(day, (dailySeconds.get(day) ?? 0) + seconds);
    }
  }
  return {
    ...home,
    stats: {
      ...home.stats,
      hoursReading: Math.floor(totalSeconds / SECONDS_PER_HOUR),
    },
    mastery: composeMastery(
      { ...home.mastery, days: [] },
      dailySeconds,
      home.mastery.dailyGoalMinutes,
      dayKey(new Date(), timeZone),
    ),
  };
}
