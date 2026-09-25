import { splitReadingDays } from "./reading-days";

import type { ReadingDaySource } from "@/lib/api-types/reading-day-source";

export function readingSnapshotDays(source: ReadingDaySource) {
  const seconds = new Map<string, number>();
  const legacy = source.version === 3 ? (source.legacyDays ?? []) : source.days;
  for (const day of legacy)
    seconds.set(day.key, (seconds.get(day.key) ?? 0) + day.seconds);
  if (source.version === 3) {
    for (const interval of source.intervals ?? []) {
      for (const [key, value] of splitReadingDays(
        Date.parse(interval.startedAt),
        Date.parse(interval.endedAt),
        interval.timeZone ?? "UTC",
      ))
        seconds.set(key, (seconds.get(key) ?? 0) + value);
    }
  }
  return seconds;
}
