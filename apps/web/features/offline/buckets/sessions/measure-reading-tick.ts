import { SESSION_MAX_GAP_MS, SESSION_CLOCK_TOLERANCE_MS } from "./constants";
import type { ReadingMoment, ReadingTick } from "./types";

export function measureReadingTick(
  previous: ReadingMoment,
  current: ReadingMoment,
): ReadingTick {
  const elapsedMs = current.monotonicNow - previous.monotonicNow;
  const wallElapsed = current.wallNow - previous.wallNow;
  const interrupted =
    elapsedMs < 0 ||
    wallElapsed < 0 ||
    Math.max(elapsedMs, wallElapsed) > SESSION_MAX_GAP_MS ||
    Math.abs(elapsedMs - wallElapsed) > SESSION_CLOCK_TOLERANCE_MS;
  return { wallNow: current.wallNow, elapsedMs, interrupted };
}
