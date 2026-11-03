import type { loadZonedReadingSnapshot } from './load-zoned-reading-snapshot';
import type { readingWindow } from './reading-window';
import { readingWindowData } from './reading-window-data';

export function buildZonedReadingSnapshot(
  window: ReturnType<typeof readingWindow>,
  snapshot: Awaited<ReturnType<typeof loadZonedReadingSnapshot>>,
  timeZone: string,
) {
  const { firstDay, ...data } = readingWindowData(
    snapshot.segments,
    snapshot.intervals,
    window,
    timeZone,
  );
  const first = data.days[0].key;
  const hasEarlier =
    (snapshot.earliestDay && snapshot.earliestDay < window.start) ||
    (firstDay !== null && firstDay < first);
  return {
    ...data,
    totalSeconds: snapshot.totalSeconds,
    ...snapshot.coverage,
    nextBefore: hasEarlier ? first : null,
  };
}
