import type { HomePayload } from "@/lib/api-types";

export type Mastery = HomePayload["mastery"];
export type MasteryDay = Mastery["days"][number];

export const GOAL_BAR_HEIGHT_PERCENT = 100;

export function makeBarHeightCalculator(mastery: Mastery) {
  const goalMinutes = Math.max(mastery.dailyGoalMinutes, 1);
  const peakMinutes = Math.max(
    ...mastery.days.map((day) => day.minutes),
    goalMinutes,
  );

  return (minutes: number) => {
    const safeMinutes = Math.max(minutes, 0);

    if (safeMinutes <= goalMinutes) {
      return (safeMinutes / goalMinutes) * GOAL_BAR_HEIGHT_PERCENT;
    }

    if (peakMinutes <= goalMinutes) {
      return GOAL_BAR_HEIGHT_PERCENT;
    }

    const overflowRatio = (safeMinutes - goalMinutes) / (peakMinutes - goalMinutes);
    return GOAL_BAR_HEIGHT_PERCENT + overflowRatio * (100 - GOAL_BAR_HEIGHT_PERCENT);
  };
}

export function formatRemainingCopy(remainingMinutes: number) {
  return remainingMinutes > 0
    ? `${remainingMinutes} minutes to reach your daily goal`
    : "Daily goal met. Keep the momentum going.";
}
