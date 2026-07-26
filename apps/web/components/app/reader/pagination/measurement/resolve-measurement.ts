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
  return measurementEntry?.status ?? READER_MEASUREMENT_STATUS_PENDING;
}

export function resolveReadyMeasurementEntry(
  measurementEntry: ReaderMeasurementEntry | null,
): ReadyReaderMeasurementEntry | null {
  return measurementEntry?.status === READER_MEASUREMENT_STATUS_READY
    ? measurementEntry
    : null;
}

export function resolvePageResolutionForLocator(input: {
  activeChapterId: string;
  locator: ReaderLocator | null;
  measurementEntry: ReadyReaderMeasurementEntry | null;
}): ReaderMeasurementPageResolution | null {
  if (!input.measurementEntry || !input.locator) {
    return null;
  }

  if (input.locator.chapterId !== input.activeChapterId) {
    return null;
  }

  return input.measurementEntry.resolvePageIndex(input.locator);
}
