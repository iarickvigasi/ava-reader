// Captured around actual coordinator work. Inclusive wall intervals can
// overlap child units; they are neither CPU time nor summable stage totals.
export type ConversionWorkTiming = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};
export function startConversionWork() {
  try {
    const startedAt = new Date().toISOString(),
      started = performance.now();
    return (): ConversionWorkTiming | undefined => {
      try {
        const endedAt = new Date().toISOString(),
          durationMs = Math.floor(performance.now() - started);
        if (
          !Number.isSafeInteger(durationMs) ||
          durationMs < 0 ||
          durationMs > 86_400_000 ||
          Date.parse(endedAt) < Date.parse(startedAt)
        )
          return undefined;
        return { startedAt, endedAt, durationMs };
      } catch {
        return undefined;
      }
    };
  } catch {
    return () => undefined;
  }
}
export function workEventTiming(work?: ConversionWorkTiming) {
  return work
    ? {
        observedAt: work.endedAt,
        durationMs: work.durationMs,
        durationKind: 'OBSERVED_WALL_CLOCK' as const,
      }
    : {};
}
export function workEventDetails(work?: ConversionWorkTiming) {
  return work
    ? {
        startedAt: work.startedAt,
        endedAt: work.endedAt,
        timingScope: 'COORDINATOR_UNIT_INCLUSIVE_WALL_NOT_SUMMABLE' as const,
        timingStatus: 'MEASURED' as const,
      }
    : { timingStatus: 'UNOBSERVED' as const };
}
