import type { HomePayload } from "@/lib/api-types";

export type Mastery = HomePayload["mastery"];
export type MasteryDay = Mastery["days"][number];

const OVERFLOW_HEADROOM_RATIO = 0.1;
export const GOAL_BAR_HEIGHT_PERCENT = 100 / (1 + OVERFLOW_HEADROOM_RATIO);

export function makeBarHeightCalculator(mastery: Mastery) {
  const goalMinutes = Math.max(mastery.dailyGoalMinutes, 1);
  const ceilingMinutes = goalMinutes * (1 + OVERFLOW_HEADROOM_RATIO);

  return (minutes: number) => {
    const clamped = Math.min(Math.max(minutes, 0), ceilingMinutes);
    return (clamped / ceilingMinutes) * 100;
  };
}
