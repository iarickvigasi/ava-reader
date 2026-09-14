// Pure composition functions: server baseline + local deltas → augmented
// stats. No Dexie, no React. The hooks layer hydrates them with values
// produced by `./local-deltas`.
//
// Sessions/highlights add pending local changes to the server snapshot.
// Completion counts use the aggregate reconciliation in completion/counts;
// the home hook passes that effective total with no additional volume delta.

import type { HomePayload } from "@/lib/api-types";

import type { UnsyncedSessionDeltas } from "./local-deltas";

export type HomeStatsDeltas = {
  hoursReadingExtraSeconds: number;
  highlightsNet: number;
  // Signed change from a raw snapshot. Pass zero for an already-composed
  // readHome payload; removing a finish date can produce a negative delta.
  volumesReadDelta: number;
  // aiComments delta is a future phase 5 hook. For now we always pass 0.
  aiCommentsNet: number;
};

export function composeHomeStats(
  baseline: HomePayload["stats"],
  deltas: HomeStatsDeltas,
): HomePayload["stats"] {
  // hoursReading: server already has integer-hours. We add the unsynced
  // seconds to the *original* second-count by reversing the floor — but
  // we don't know the residual fractional hour. Cheapest acceptable
  // approximation: add floor(extraSeconds / 3600) on top. This may
  // under-count by up to ~59 minutes between server snapshots, which
  // matches the server's own integer-hour reporting granularity.
  const extraHours = Math.floor(
    Math.max(0, deltas.hoursReadingExtraSeconds) / 3600,
  );
  return {
    aiComments: Math.max(0, baseline.aiComments + deltas.aiCommentsNet),
    highlights: Math.max(0, baseline.highlights + deltas.highlightsNet),
    hoursReading: baseline.hoursReading + extraHours,
    volumesRead: Math.max(0, baseline.volumesRead + deltas.volumesReadDelta),
  };
}

// Augments mastery daily bars with unsynced session minutes. Only days
// that already exist in the server's `mastery.days` window are touched —
// if the cached payload is from a previous week, we don't fabricate new
// buckets. `todayMinutes` + `remainingMinutes` get recomputed against
// `dailyGoalMinutes` so the goal-bar UI stays in sync.
export function composeMastery(
  baseline: HomePayload["mastery"],
  byUtcDaySeconds: UnsyncedSessionDeltas["byUtcDaySeconds"],
): HomePayload["mastery"] {
  // Each day's `minutes` is server-floored from seconds. We add
  // floor(localSeconds / 60). Mismatch is bounded by 1 minute per day
  // worst case, which is below human perception for these bars.
  const days = baseline.days.map((day) => {
    const extraSeconds = byUtcDaySeconds.get(day.key) ?? 0;
    const extraMinutes = Math.floor(Math.max(0, extraSeconds) / 60);
    if (extraMinutes === 0) {
      return day;
    }
    const minutes = day.minutes + extraMinutes;
    return {
      ...day,
      minutes,
      goalMet: minutes >= baseline.dailyGoalMinutes,
    };
  });

  const todayMinutes = days.at(-1)?.minutes ?? 0;
  const remainingMinutes = Math.max(
    0,
    baseline.dailyGoalMinutes - todayMinutes,
  );

  return {
    ...baseline,
    days,
    todayMinutes,
    remainingMinutes,
  };
}

// Augments the per-book reading time on book-info. `baselineMinutes` is
// the server-confirmed minutes-read for the book; we add the user's
// unsynced reading time for the same book.
export function composeBookMinutesRead(
  baselineMinutes: number,
  unsyncedSecondsForBook: number,
): number {
  const extraMinutes = Math.floor(Math.max(0, unsyncedSecondsForBook) / 60);
  return baselineMinutes + extraMinutes;
}
