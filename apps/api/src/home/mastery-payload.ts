import { dayKey } from '../shared/reading-days';

const MASTERY_DAYS = 7;
const DEFAULT_DAILY_GOAL_MINUTES = 60;
const SECONDS_PER_MINUTE = 60;

export function createMasteryPayload(
  readingSessions: Array<{ durationSeconds: number; trackedDay: Date }>,
  readingGoalMinutes: number | null = null,
  timeZone = 'UTC',
) {
  const dailyGoalMinutes = readingGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES;
  const daySecondsMap = new Map<string, number>();

  for (const session of readingSessions) {
    const key = session.trackedDay.toISOString().slice(0, 10);
    daySecondsMap.set(
      key,
      (daySecondsMap.get(key) ?? 0) + session.durationSeconds,
    );
  }

  const days = Array.from({ length: MASTERY_DAYS }, (_, index) => {
    const today = Date.parse(`${dayKey(new Date(), timeZone)}T00:00:00Z`);
    const date = new Date(today - (MASTERY_DAYS - 1 - index) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const minutes = Math.floor(
      (daySecondsMap.get(key) ?? 0) / SECONDS_PER_MINUTE,
    );

    // The client formats the weekday label from `key` using the user's
    // locale — don't ship a server-localized string.
    return {
      goalMet: minutes >= dailyGoalMinutes,
      key,
      minutes,
    };
  });

  const todayMinutes = days.at(-1)?.minutes ?? 0;

  return {
    dailyGoalMinutes,
    days,
    remainingMinutes: Math.max(dailyGoalMinutes - todayMinutes, 0),
    todayMinutes,
  };
}
