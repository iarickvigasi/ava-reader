import { useCallback, useRef, useState } from "react";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import {
  resolveMeasurementStatus,
  resolveReadyMeasurementEntry,
} from "./resolve-measurement";

export function useMeasurementCache({
  activePaginationLayoutKey,
  previousPaginationLayoutKey,
}: {
  activePaginationLayoutKey: string | null;
  // Layout key of the previous chapter — lets the spread logic ask "is the
  // previous chapter single-page?" without exposing the entire cache.
  previousPaginationLayoutKey?: string | null;
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

  // Page count for the previous chapter, used by the spread logic in
  // useReaderPagination to decide whether to render the prefix.
  const previousReadyMeasurementEntry = previousPaginationLayoutKey
    ? resolveReadyMeasurementEntry(
        measurementEntries.get(previousPaginationLayoutKey) ?? null,
      )
    : null;
  const previousChapterPageCount =
    previousReadyMeasurementEntry?.pageCount ?? null;

  const storeMeasurementEntry = useCallback((entry: ReaderMeasurementEntry) => {
    setMeasurementEntries((current) => {
      const currentEntry = current.get(entry.layoutKey);
      const entryToStore = selectMeasurementEntryToStore(currentEntry, entry);

      if (entryToStore === currentEntry) {
        return current;
      }

      const next = new Map(current);
      next.set(entry.layoutKey, entryToStore);
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
    previousChapterPageCount,
    storeMeasurementEntry,
    warnFailedMeasurement,
  };
}

export function selectMeasurementEntryToStore(
  currentEntry: ReaderMeasurementEntry | undefined,
  incomingEntry: ReaderMeasurementEntry,
) {
  if (!currentEntry || currentEntry.status !== "ready") {
    return incomingEntry;
  }

  if (incomingEntry.status !== "ready") {
    return currentEntry;
  }

  if (currentEntry.pageCount > 1 && incomingEntry.pageCount === 1) {
    return currentEntry;
  }

  return incomingEntry;
}
