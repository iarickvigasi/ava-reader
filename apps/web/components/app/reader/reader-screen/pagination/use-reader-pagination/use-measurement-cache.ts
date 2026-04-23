import { useCallback, useRef, useState } from "react";
import type { ReaderMeasurementEntry } from "@/lib/reader-measurement";
import {
  resolveMeasurementStatus,
  resolveReadyMeasurementEntry,
} from "../use-reader-pagination.helpers";

export function useMeasurementCache({
  activePaginationLayoutKey,
}: {
  activePaginationLayoutKey: string | null;
}) {
  const [measurementEntries, setMeasurementEntries] = useState(
    () => new Map<string, ReaderMeasurementEntry>(),
  );
  const warnedFailedMeasurementKeysRef = useRef(new Set<string>());

  const activeMeasurementEntry = activePaginationLayoutKey
    ? (measurementEntries.get(activePaginationLayoutKey) ?? null)
    : null;

  const activeReadyMeasurementEntry =
    resolveReadyMeasurementEntry(activeMeasurementEntry);
  const activeMeasurementStatus = resolveMeasurementStatus(activeMeasurementEntry);
  const pageCount = activeReadyMeasurementEntry?.pageCount ?? 1;

  const storeMeasurementEntry = useCallback((entry: ReaderMeasurementEntry) => {
    setMeasurementEntries((current) => {
      const next = new Map(current);
      next.set(entry.layoutKey, entry);
      return next;
    });
  }, []);

  const warnFailedMeasurement = useCallback((layoutKey: string) => {
    if (warnedFailedMeasurementKeysRef.current.has(layoutKey)) {
      return;
    }

    warnedFailedMeasurementKeysRef.current.add(layoutKey);
    console.warn(
      `Reader measurement failed for ${layoutKey}. Falling back to chapter-level restore.`,
    );
  }, []);

  return {
    activeMeasurementEntry,
    activeMeasurementStatus,
    activeReadyMeasurementEntry,
    pageCount,
    storeMeasurementEntry,
    warnFailedMeasurement,
  };
}
