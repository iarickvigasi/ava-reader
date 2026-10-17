import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import {
  resolveMeasurementStatus,
  resolveReadyMeasurementEntry,
} from "./resolve-measurement";
import {
  retainMeasurements,
  storeScopedMeasurement,
  type MeasurementCache,
} from "./retain-measurements";

export function useMeasurementCache({
  activePaginationLayoutKey,
  previousPaginationLayoutKey,
}: {
  activePaginationLayoutKey: string | null;
  // Layout key of the previous chapter — lets the spread logic ask "is the
  // previous chapter single-page?" without exposing the entire cache.
  previousPaginationLayoutKey?: string | null;
}) {
  const scope = useMemo(
    () => ({
      active: activePaginationLayoutKey,
      previous: previousPaginationLayoutKey ?? null,
    }),
    [activePaginationLayoutKey, previousPaginationLayoutKey],
  );
  const [cache, setCache] = useState<MeasurementCache>(() => ({
    scope,
    entries: new Map(),
  }));
  const retained = retainMeasurements(cache, scope);
  if (retained !== cache) setCache(retained);
  const measurementEntries = retained.entries;
  const warnings = useRef({ scope, keys: new Set<string>() });
  useLayoutEffect(() => {
    warnings.current = { scope, keys: new Set() };
  }, [scope]);

  const activeMeasurementEntry = activePaginationLayoutKey
    ? (measurementEntries.get(activePaginationLayoutKey) ?? null)
    : null;

  const activeReadyMeasurementEntry = resolveReadyMeasurementEntry(
    activeMeasurementEntry,
  );
  const activeMeasurementStatus = resolveMeasurementStatus(
    activeMeasurementEntry,
  );
  const pageCount = activeReadyMeasurementEntry?.pageCount ?? 1;

  // Page count for the previous chapter, used by the spread logic in
  // useReaderPagination to decide whether to render the prefix.
  const previousReadyMeasurementEntry = previousPaginationLayoutKey
    ? resolveReadyMeasurementEntry(
        measurementEntries.get(previousPaginationLayoutKey) ?? null,
      )
    : null;
  const previousChapterPageCount =
    previousReadyMeasurementEntry?.pageCount ?? null;

  const storeMeasurementEntry = useCallback(
    (entry: ReaderMeasurementEntry) => {
      setCache((current) => storeScopedMeasurement(current, scope, entry));
    },
    [scope],
  );

  const warnFailedMeasurement = useCallback(
    (layoutKey: string) => {
      if (
        warnings.current.scope !== scope ||
        (layoutKey !== scope.active && layoutKey !== scope.previous) ||
        warnings.current.keys.has(layoutKey)
      ) {
        return;
      }

      warnings.current.keys.add(layoutKey);
      console.warn(
        `Reader measurement failed for ${layoutKey}. Falling back to chapter-level restore.`,
      );
    },
    [scope],
  );

  return {
    activeMeasurementEntry,
    activeMeasurementStatus,
    activeReadyMeasurementEntry,
    pageCount,
    previousChapterPageCount,
    storeMeasurementEntry,
    warnFailedMeasurement,
  };
}
