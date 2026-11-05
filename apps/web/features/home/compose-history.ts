import type { SessionRow } from "@/features/offline/db";
import { composeReadingDays } from "@/features/offline/stats/compose-reading-days";
import type { MasteryHistoryPage } from "./types";

export function composeHistory(
  page: MasteryHistoryPage,
  sessions: SessionRow[],
  goal: number,
) {
  const { dailySeconds } = composeReadingDays(page, sessions);
  return page.days.map(({ key }) => {
    const minutes = Math.floor((dailySeconds.get(key) ?? 0) / 60);
    return { key, minutes, goalMet: minutes >= goal };
  });
}
