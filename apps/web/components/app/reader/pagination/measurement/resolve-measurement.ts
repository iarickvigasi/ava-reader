import type { ReaderLocator } from "@/lib/api-types";
import type {
  ReaderMeasurementEntry,
  ReaderMeasurementPageResolution,
} from "@/features/reader/measurement";

export const READER_MEASUREMENT_STATUS_PENDING = "pending";
export const READER_MEASUREMENT_STATUS_READY = "ready";

export type ReadyReaderMeasurementEntry = Extract<
  ReaderMeasurementEntry,
  { status: "ready" }
>;

export function resolveMeasurementStatus(
  measurementEntry: ReaderMeasurementEntry | null,
) {
  return measurementEntry?.status === "ready" &&
    !resolveReadyMeasurementEntry(measurementEntry)
    ? READER_MEASUREMENT_STATUS_PENDING
    : (measurementEntry?.status ?? READER_MEASUREMENT_STATUS_PENDING);
}

export function resolveReadyMeasurementEntry(
  measurementEntry: ReaderMeasurementEntry | null,
): ReadyReaderMeasurementEntry | null {
  return measurementEntry?.status === READER_MEASUREMENT_STATUS_READY &&
    measurementEntry.isCurrent?.() !== false
    ? measurementEntry
    : null;
}

export function resolvePageResolutionForLocator(input: {
  activeChapterId: string;
  locator: ReaderLocator | null;
  measurementEntry: ReadyReaderMeasurementEntry | null;
}): ReaderMeasurementPageResolution | null {
  const measurement = resolveReadyMeasurementEntry(input.measurementEntry);
  if (!measurement || !input.locator) {
    return null;
  }

  if (input.locator.chapterId !== input.activeChapterId) {
    return null;
  }

  return measurement.resolvePageIndex(input.locator);
}
