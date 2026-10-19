import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import { resolveReadyMeasurementEntry } from "./resolve-measurement";

export type MeasurementScope = {
  active: string | null;
  previous: string | null;
};
export type MeasurementCache = {
  scope: MeasurementScope;
  entries: Map<string, ReaderMeasurementEntry>;
};

// Only the current and previous chapter are cache consumers. A changed scope
// also retires old callbacks even when the viewport later returns to an old key.
export function retainMeasurements(
  cache: MeasurementCache,
  scope: MeasurementScope,
): MeasurementCache {
  const entries = new Map(
    [...cache.entries].filter(
      ([key, entry]) =>
        (key === scope.active || key === scope.previous) &&
        (entry.status !== "ready" || resolveReadyMeasurementEntry(entry)),
    ),
  );
  return cache.scope === scope && entries.size === cache.entries.size
    ? cache
    : { scope, entries };
}

export function storeScopedMeasurement(
  current: MeasurementCache,
  scope: MeasurementScope,
  entry: ReaderMeasurementEntry,
): MeasurementCache {
  if (
    current.scope !== scope ||
    (entry.layoutKey !== scope.active && entry.layoutKey !== scope.previous)
  )
    return current;
  const kept = retainMeasurements(current, scope);
  if (entry.status === "ready" && !resolveReadyMeasurementEntry(entry))
    return kept;
  const entries = new Map(kept.entries);
  entries.set(entry.layoutKey, entry);
  return { scope, entries };
}
