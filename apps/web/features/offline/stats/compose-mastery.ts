import type { HomePayload } from "@/lib/api-types";
import type { UnsyncedSessionDeltas } from "./local-deltas";

const MASTERY_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

export function composeMastery(
  baseline: HomePayload["mastery"],
  byUtcDaySeconds: UnsyncedSessionDeltas["byUtcDaySeconds"],
  dailyGoalMinutes = baseline.dailyGoalMinutes,
  todayKey = new Date().toISOString().slice(0, 10),
): HomePayload["mastery"] {
  // Each day's `minutes` is server-floored from seconds. We add
  // floor(localSeconds / 60). Mismatch is bounded by 1 minute per day
  // because the cached payload does not retain residual seconds.
  const cachedDays = new Map(baseline.days.map((day) => [day.key, day]));
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const days = Array.from({ length: MASTERY_DAYS }, (_, index) => {
    const key = new Date(
      today - (MASTERY_DAYS - 1 - index) * MILLISECONDS_PER_DAY,
    )
      .toISOString()
      .slice(0, 10);
    const day = cachedDays.get(key) ?? { key, minutes: 0, goalMet: false };
    const extraSeconds = byUtcDaySeconds.get(day.key) ?? 0;
    const extraMinutes = Math.floor(Math.max(0, extraSeconds) / 60);
    const minutes = day.minutes + extraMinutes;
    const goalMet = minutes >= dailyGoalMinutes;
    if (extraMinutes === 0 && goalMet === day.goalMet) {
      return day;
    }
    return {
      ...day,
      minutes,
      goalMet,
    };
  });

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
