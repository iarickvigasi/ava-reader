import { startOfDay } from '../../shared/date-utils';

const SESSION_SECONDS_PER_DAY = 86_400;

// A span that crosses midnight UTC belongs to two days. Splitting it keeps the
// per-day reading totals on home honest.
export function splitSessionSeconds(start: Date, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) {
    return [] as Array<{ durationSeconds: number; trackedDay: Date }>;
  }

  const segments: Array<{ durationSeconds: number; trackedDay: Date }> = [];
  let cursorSeconds = Math.floor(start.getTime() / 1000);
  const endSeconds = cursorSeconds + elapsedSeconds;

  while (cursorSeconds < endSeconds) {
    const cursorDate = new Date(cursorSeconds * 1000);
    const trackedDay = startOfDay(cursorDate);
    const nextDayBoundarySeconds =
      Math.floor(trackedDay.getTime() / 1000) + SESSION_SECONDS_PER_DAY;
    const sliceEnd = Math.min(endSeconds, nextDayBoundarySeconds);
    const durationSeconds = Math.max(sliceEnd - cursorSeconds, 0);

    if (durationSeconds > 0) {
      segments.push({
        durationSeconds,
        trackedDay,
      });
    }

    cursorSeconds = sliceEnd;
  }

  return segments;
}
