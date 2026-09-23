const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_SECOND = 1_000;

// Match API computeElapsedSeconds, clampReplayDuration and session-segments:
// round once, cap replay time, then split from the floored start second.
export function splitSecondsByUtcDay(
  startedAt: string,
  endedAt: string,
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
  let cursor = Math.floor(start / MILLISECONDS_PER_SECOND);
  const stop = cursor + seconds;
  while (cursor < stop) {
    const nextMidnight =
      (Math.floor(cursor / SECONDS_PER_DAY) + 1) * SECONDS_PER_DAY;
    const sliceEnd = Math.min(stop, nextMidnight);
    slices.set(
      new Date(cursor * MILLISECONDS_PER_SECOND).toISOString().slice(0, 10),
      sliceEnd - cursor,
    );
    cursor = sliceEnd;
  }
  return slices;
}
