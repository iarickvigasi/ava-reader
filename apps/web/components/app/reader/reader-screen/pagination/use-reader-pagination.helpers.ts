import type { ReaderLocator } from "@/lib/api-types";
import type {
  ReaderMeasurementEntry,
  ReaderMeasurementPageResolution,
} from "@/lib/reader-measurement";

export const READER_MEASUREMENT_STATUS_PENDING = "pending";
export const READER_MEASUREMENT_STATUS_READY = "ready";
export const READER_RESTORE_PHASE_RESTORING = "restoring";
export const READER_RESTORE_PHASE_SETTLED = "settled";
export const PAGE_DIRECTION_FORWARD = 1;
export const PAGE_DIRECTION_BACKWARD = -1;

export type ReaderRestorePhase =
  | typeof READER_RESTORE_PHASE_RESTORING
  | typeof READER_RESTORE_PHASE_SETTLED;
export type PaginationPageDirection =
  | typeof PAGE_DIRECTION_BACKWARD
  | typeof PAGE_DIRECTION_FORWARD;
export type ReadyReaderMeasurementEntry = Extract<
  ReaderMeasurementEntry,
  { status: "ready" }
>;

export type SwipeNavigationOutcome =
  | "next-page"
  | "none"
  | "previous-page";

export type PageStepOutcome =
  | {
      kind: "noop-boundary";
    }
  | {
      kind: "noop-loading";
    }
  | {
      edge: "end" | "start";
      kind: "select-chapter";
      nextChapterId: string;
    }
  | {
      kind: "step-page";
    };

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

export function resolveRestorePhase(input: {
  activeMeasurementStatus: ReaderMeasurementEntry["status"];
  activeRestoreCycleKey: string;
  settledRestoreCycleKey: string | null;
}): ReaderRestorePhase {
  if (
    input.settledRestoreCycleKey === input.activeRestoreCycleKey &&
    input.activeMeasurementStatus !== READER_MEASUREMENT_STATUS_PENDING
  ) {
    return READER_RESTORE_PHASE_SETTLED;
  }

  return READER_RESTORE_PHASE_RESTORING;
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

export function areLocatorsEqual(
  left: ReaderLocator | null,
  right: ReaderLocator | null,
) {
  return (
    left?.chapterId === right?.chapterId &&
    left?.blockId === right?.blockId &&
    left?.textOffset === right?.textOffset
  );
}

export function resolveVisibleLocatorPublishDecision(input: {
  activeReadyMeasurementEntry: ReadyReaderMeasurementEntry | null;
  currentPageIndex: number;
  isBootstrapping: boolean;
  restorePhase: ReaderRestorePhase;
  visibleLocator: ReaderLocator | null;
}) {
  if (
    input.isBootstrapping ||
    input.restorePhase !== READER_RESTORE_PHASE_SETTLED ||
    !input.activeReadyMeasurementEntry
  ) {
    return {
      nextLocator: null,
      shouldPublishLocator: false,
    };
  }

  const nextLocator = input.activeReadyMeasurementEntry.resolveLocator(
    input.currentPageIndex,
  );

  if (!nextLocator || areLocatorsEqual(input.visibleLocator, nextLocator)) {
    return {
      nextLocator: null,
      shouldPublishLocator: false,
    };
  }

  return {
    nextLocator,
    shouldPublishLocator: true,
  };
}

export function resolveSwipeNavigationOutcome(input: {
  deltaX: number;
  deltaY: number;
  swipeMaxOffAxis: number;
  swipeThreshold: number;
}): SwipeNavigationOutcome {
  if (
    Math.abs(input.deltaX) < input.swipeThreshold ||
    Math.abs(input.deltaY) > input.swipeMaxOffAxis ||
    Math.abs(input.deltaY) > Math.abs(input.deltaX)
  ) {
    return "none";
  }

  return input.deltaX < 0 ? "next-page" : "previous-page";
}

export function resolvePageStepOutcome(input: {
  currentPageIndex: number;
  direction: PaginationPageDirection;
  isLoadingChapter: boolean;
  nextChapterId: string | null;
  pageCount: number;
  previousChapterId: string | null;
}): PageStepOutcome {
  if (input.isLoadingChapter) {
    return { kind: "noop-loading" };
  }

  const hasPreviousPage = input.currentPageIndex > 0;
  const hasNextPage = input.currentPageIndex < input.pageCount - 1;
  const isForward = input.direction === PAGE_DIRECTION_FORWARD;
  const hasNeighborPage = isForward ? hasNextPage : hasPreviousPage;

  if (hasNeighborPage) {
    return {
      kind: "step-page",
    };
  }

  const nextChapterId = isForward ? input.nextChapterId : input.previousChapterId;
  if (!nextChapterId) {
    return { kind: "noop-boundary" };
  }

  return {
    edge: isForward ? "start" : "end",
    kind: "select-chapter",
    nextChapterId,
  };
}
