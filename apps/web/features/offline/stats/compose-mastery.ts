import { deviceTimeZone } from "./device-time-zone";
import { dayKey } from "./reading-days";
import type { HomePayload } from "@/lib/api-types";

const MASTERY_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

export function composeMastery(
  baseline: HomePayload["mastery"],
  byDaySeconds: ReadonlyMap<string, number>,
  dailyGoalMinutes = baseline.dailyGoalMinutes,
  todayKey = dayKey(new Date(), deviceTimeZone()),
): HomePayload["mastery"] {
  const cachedDays = new Map(baseline.days.map((day) => [day.key, day]));
  const days = masteryDayKeys(todayKey).map((key) =>
    composeMasteryDay(
      cachedDays.get(key) ?? { key, minutes: 0, goalMet: false },
      byDaySeconds.get(key) ?? 0,
      dailyGoalMinutes,
    ),
  );
  const todayMinutes = days.find((day) => day.key === todayKey)?.minutes ?? 0;
  const remainingMinutes = Math.max(0, dailyGoalMinutes - todayMinutes);

  return {
    ...baseline,
    dailyGoalMinutes,
    days,
    todayMinutes,
    remainingMinutes,
  };
}

function masteryDayKeys(todayKey: string) {
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  return Array.from({ length: MASTERY_DAYS }, (_, index) =>
    new Date(today - (MASTERY_DAYS - 1 - index) * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10),
  );
}

function composeMasteryDay(
  day: HomePayload["mastery"]["days"][number],
  extraSeconds: number,
  dailyGoalMinutes: number,
) {
  // Older cached day totals have no residual seconds to combine before rounding.
  const extraMinutes = Math.floor(Math.max(0, extraSeconds) / 60);
  const minutes = day.minutes + extraMinutes;
  const goalMet = minutes >= dailyGoalMinutes;
  return extraMinutes === 0 && goalMet === day.goalMet
    ? day
    : { ...day, minutes, goalMet };
}
