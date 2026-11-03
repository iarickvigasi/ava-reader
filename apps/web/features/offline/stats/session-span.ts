import { SESSION_MAX_DURATION_MS } from "../buckets/sessions";
const MILLISECONDS_PER_SECOND = 1_000;

// Match server checkpoint rounding before splitting into calendar days.
export function sessionSpan(startedAt: string, endedAt: string) {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return null;
  const seconds = Math.min(
    SESSION_MAX_DURATION_MS / MILLISECONDS_PER_SECOND,
    Math.round((end - start) / MILLISECONDS_PER_SECOND),
  );
  const wholeStart =
    Math.floor(start / MILLISECONDS_PER_SECOND) * MILLISECONDS_PER_SECOND;
  return {
    start: wholeStart,
    end: wholeStart + seconds * MILLISECONDS_PER_SECOND,
    seconds,
  };
}
