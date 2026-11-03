import { deviceTimeZone } from "./device-time-zone";
import { dayKey } from "./reading-days";
import type { HomePayload } from "@/lib/api-types/home";
import type { SessionRow } from "../db";
import { composeMastery } from "./compose-mastery";
import { composeReadingDays } from "./compose-reading-days";

const SECONDS_PER_HOUR = 3600;

// Called with the raw home row and sessions from the same Dexie transaction.
// Upload state controls retries; snapshot membership controls displayed time.
export function composeHomeReading(
  home: HomePayload,
  sessions: SessionRow[],
  timeZone = deviceTimeZone(),
): HomePayload {
  if (!home.readingSnapshot && sessions.length === 0) return home;
  const snapshot = resolveHomeReadingSnapshot(home);
  const { dailySeconds, extraSeconds } = composeReadingDays(snapshot, sessions);
  const totalSeconds = snapshot.totalSeconds + extraSeconds;
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

function resolveHomeReadingSnapshot(home: HomePayload) {
  return (
    home.readingSnapshot ?? {
      clientSessionIds: [],
      totalSeconds: home.stats.hoursReading * SECONDS_PER_HOUR,
      days: home.mastery.days.map((day) => ({
        key: day.key,
        seconds: day.minutes * 60,
      })),
    }
  );
}
