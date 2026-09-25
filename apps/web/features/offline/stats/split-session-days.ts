import { splitReadingDays } from "./reading-days";
const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_SECOND = 1_000;

// Match API computeElapsedSeconds, clampReplayDuration and session-segments:
// round once, cap replay time, then split from the floored start second.
export function splitSessionDays(
  startedAt: string,
  endedAt: string,
  timeZone = "UTC",
): Map<string, number> {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  const slices = new Map<string, number>();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return slices;
  const seconds = Math.min(
    SECONDS_PER_DAY,
    Math.round((end - start) / MILLISECONDS_PER_SECOND),
  );
  const cursor =
    Math.floor(start / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;
  return splitReadingDays(
    cursor,
    cursor + seconds * MILLISECONDS_PER_SECOND,
    timeZone,
  );
}
