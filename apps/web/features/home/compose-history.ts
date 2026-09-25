import { readingSnapshotDays } from "@/features/offline/stats/reading-snapshot";
import type { SessionRow } from "@/features/offline/db";
import { splitSessionDays } from "@/features/offline/stats/split-session-days";
import type { MasteryHistoryPage } from "./types";

export function composeHistory(
  page: MasteryHistoryPage,
  sessions: SessionRow[],
  goal: number,
) {
  const covered = new Set(page.clientSessionIds);
  const seconds = readingSnapshotDays(page);
  for (const row of sessions) {
    if (
      row.state !== "closed" ||
      !row.endedAt ||
      row.replayStatus === "dropped" ||
      covered.has(row.clientSessionId) ||
      (row.syncedAt !== null && row.replayStatus !== "acknowledged")
    )
      continue;
    for (const [key, value] of splitSessionDays(
      row.startedAt,
      row.endedAt,
      row.timeZone ?? "UTC",
    )) {
      seconds.set(key, (seconds.get(key) ?? 0) + value);
    }
  }
  return page.days.map(({ key }) => {
    const minutes = Math.floor((seconds.get(key) ?? 0) / 60);
    return { key, minutes, goalMet: minutes >= goal };
  });
}
