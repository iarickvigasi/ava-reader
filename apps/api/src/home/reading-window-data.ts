import { splitReadingDays } from '../shared/reading-days';

type Interval = { startedAt: Date; endedAt: Date; timeZone?: string | null };

export function readingWindowData(
  segments: Array<{ trackedDay: Date; durationSeconds: number }>,
  intervals: Interval[],
  window: { start: Date; end: Date; keys: string[] },
  timeZone: string,
) {
  const legacy = new Map<string, number>();
  for (const row of segments) {
    const key = row.trackedDay.toISOString().slice(0, 10);
    legacy.set(key, (legacy.get(key) ?? 0) + row.durationSeconds);
  }
  const clipped = intervals.map((row) => ({
    timeZone: row.timeZone ?? 'UTC',
    startedAt: new Date(Math.max(+row.startedAt, +window.start)).toISOString(),
    endedAt: new Date(Math.min(+row.endedAt, +window.end)).toISOString(),
  }));
  const local = new Map<string, number>();
  for (const row of clipped) {
    const start = Date.parse(row.startedAt),
      end = Date.parse(row.endedAt);
    for (const [key, seconds] of splitReadingDays(start, end, 'UTC')) {
      legacy.set(key, (legacy.get(key) ?? 0) - seconds);
    }
    for (const [key, seconds] of splitReadingDays(start, end, row.timeZone)) {
      local.set(key, (local.get(key) ?? 0) + seconds);
    }
  }
  const legacyDays = [...legacy]
    .filter(([, seconds]) => seconds > 0)
    .map(([key, seconds]) => ({ key, seconds }));
  for (const { key, seconds } of legacyDays)
    local.set(key, (local.get(key) ?? 0) + seconds);
  return {
    firstDay: [...local.keys()].sort()[0] ?? null,
    version: 3 as const,
    timeZone,
    intervals: clipped,
    legacyDays,
    days: window.keys.map((key) => ({ key, seconds: local.get(key) ?? 0 })),
  };
}
