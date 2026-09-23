"use client";

import { useReadingGoal } from "@/components/app/preferences/use-reading-goal";
import type { HomePayload } from "@/lib/api-types";
import { useHomeWithCache } from "../buckets/home/hooks";

import {
  composeBookMinutesRead,
  composeHomeStats,
  composeMastery,
  type HomeStatsDeltas,
} from "./compose";
import { useDeltaBundle } from "./use-delta-bundle";

export function useComposedHomeStats(
  home: HomePayload | null,
): HomePayload["stats"] | null {
  const bundle = useDeltaBundle();
  const effective = useHomeWithCache(home);
  if (!effective) {
    return null;
  }
  const deltas: HomeStatsDeltas = {
    // readHome reconciles reading time and completion against its own snapshot.
    hoursReadingExtraSeconds: 0,
    highlightsNet: bundle.highlightsNet,
    // readHome has already composed this count, including acknowledged edits
    // newer than its snapshot. Adding a separate pending delta would double it.
    volumesReadDelta: 0,
    aiCommentsNet: 0,
  };
  return composeHomeStats(effective.stats, deltas);
}

export function useComposedMastery(
  home: HomePayload | null,
): HomePayload["mastery"] | null {
  const bundle = useDeltaBundle();
  const effective = useHomeWithCache(home);
  const [readingGoal] = useReadingGoal(effective?.mastery.dailyGoalMinutes);
  if (!effective) {
    return null;
  }
  if (!bundle.todayKey) {
    const days = effective.mastery.days.map((day) => ({
      ...day,
      goalMet: day.minutes >= readingGoal,
    }));
    return {
      ...effective.mastery,
      days,
      dailyGoalMinutes: readingGoal,
      remainingMinutes: Math.max(
        0,
        readingGoal - effective.mastery.todayMinutes,
      ),
    };
  }
  return composeMastery(
    effective.mastery,
    new Map(),
    readingGoal,
    bundle.todayKey,
  );
}

export function useComposedBookMinutesRead(
  libraryItemId: string,
  baselineMinutes: number,
): number {
  const bundle = useDeltaBundle();
  const extraSeconds = bundle.sessions.byBookSeconds.get(libraryItemId) ?? 0;
  return composeBookMinutesRead(baselineMinutes, extraSeconds);
}
