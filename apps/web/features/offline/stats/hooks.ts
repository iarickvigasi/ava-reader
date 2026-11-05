"use client";

import { useReadingGoal } from "@/components/app/preferences/use-reading-goal";
import type { HomePayload } from "@/lib/api-types";
import { useHomeWithCache } from "../buckets/home/hooks";

import { composeHomeStats } from "./compose";
import { composeMastery } from "./compose-mastery";
import { useHighlightCountDelta } from "./use-highlight-count-delta";
import { useReadingCalendar } from "./use-reading-calendar";

export function useComposedHomeStats(
  home: HomePayload | null,
): HomePayload["stats"] | null {
  const highlightsNet = useHighlightCountDelta();
  const effective = useHomeWithCache(home);
  if (!effective) {
    return null;
  }
  return composeHomeStats(effective.stats, highlightsNet);
}

export function useComposedMastery(
  home: HomePayload | null,
): HomePayload["mastery"] | null {
  const todayKey = useReadingCalendar()?.split("|")[1] ?? null;
  const effective = useHomeWithCache(home);
  const [readingGoal] = useReadingGoal(effective?.mastery.dailyGoalMinutes);
  return effective
    ? applyReadingGoal(effective.mastery, readingGoal, todayKey)
    : null;
}

export { useComposedBookMinutesRead } from "./use-book-reading";

function applyReadingGoal(
  mastery: HomePayload["mastery"],
  readingGoal: number,
  todayKey: string | null,
) {
  if (todayKey)
    return composeMastery(mastery, new Map(), readingGoal, todayKey);
  return {
    ...mastery,
    days: mastery.days.map((day) => ({
      ...day,
      goalMet: day.minutes >= readingGoal,
    })),
    dailyGoalMinutes: readingGoal,
    remainingMinutes: Math.max(0, readingGoal - mastery.todayMinutes),
  };
}
