import type { loadMasteryHistorySnapshot } from './load-mastery-history-snapshot';
import type { masteryHistoryWindow } from './mastery-history-window';

export function buildMasteryHistoryPage(
  window: ReturnType<typeof masteryHistoryWindow>,
  snapshot: Awaited<ReturnType<typeof loadMasteryHistorySnapshot>>,
) {
  const seconds = new Map<string, number>();
  for (const segment of snapshot.segments) {
    const key = segment.trackedDay.toISOString().slice(0, 10);
    seconds.set(key, (seconds.get(key) ?? 0) + segment.durationSeconds);
  }
  return {
    days: window.days.map((key) => ({ key, seconds: seconds.get(key) ?? 0 })),
    ...snapshot.coverage,
    nextBefore:
      snapshot.earliestDay && snapshot.earliestDay < window.start
        ? window.days[0]
        : null,
  };
}
