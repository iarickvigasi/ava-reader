import type { SessionRow } from "@/features/offline/db";
import { splitSecondsByUtcDay } from "@/features/offline/stats/split-seconds-by-utc-day";
import type { MasteryHistoryPage } from "./types";

export function composeHistory(
  page: MasteryHistoryPage,
  sessions: SessionRow[],
  goal: number,
) {
  const covered = new Set(page.clientSessionIds);
  const seconds = new Map(page.days.map((day) => [day.key, day.seconds]));
  for (const row of sessions) {
    if (
      row.state !== "closed" ||
      !row.endedAt ||
      row.replayStatus === "dropped" ||
      covered.has(row.clientSessionId) ||
      (row.syncedAt !== null && row.replayStatus !== "acknowledged")
    )
      continue;
    for (const [key, value] of splitSecondsByUtcDay(
      row.startedAt,
      row.endedAt,
    )) {
      if (seconds.has(key)) seconds.set(key, seconds.get(key)! + value);
    }
  }
  return page.days.map(({ key }) => {
    const minutes = Math.floor(seconds.get(key)! / 60);
    return { key, minutes, goalMet: minutes >= goal };
  });
}
