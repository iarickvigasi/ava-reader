import type { HomePayload } from "@/lib/api-types/home";
import type { SessionRow } from "../db";
import { composeMastery } from "./compose-mastery";
import { splitSecondsByUtcDay } from "./split-seconds-by-utc-day";

const SECONDS_PER_HOUR = 3600;

// Called with the raw home row and sessions from the same Dexie transaction.
// Upload state controls retries; snapshot membership controls displayed time.
export function composeHomeReading(
  home: HomePayload,
  sessions: SessionRow[],
): HomePayload {
  const snapshot = home.readingSnapshot;
  if (!snapshot) return home;
  const included = new Set(snapshot.clientSessionIds);
  const dailySeconds = new Map<string, number>();
  let totalSeconds = snapshot.totalSeconds;
  for (const day of snapshot.days) {
    dailySeconds.set(day.key, (dailySeconds.get(day.key) ?? 0) + day.seconds);
  }
  for (const row of sessions) {
    if (
      row.state !== "closed" ||
      !row.endedAt ||
      row.replayStatus === "dropped" ||
      included.has(row.clientSessionId) ||
      (row.syncedAt !== null && row.replayStatus !== "acknowledged")
    )
      continue;
    for (const [day, seconds] of splitSecondsByUtcDay(
      row.startedAt,
      row.endedAt,
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
    mastery: composeMastery({ ...home.mastery, days: [] }, dailySeconds),
  };
}
