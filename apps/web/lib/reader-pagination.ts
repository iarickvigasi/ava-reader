import {
  hasPendingRestoreIntent,
  isStickyRestoreIntent,
} from "./reader-navigation";
import type { RestoreIntent } from "./reader-navigation";
import type { ReaderMeasurementPageResolution } from "./reader-measurement";

const RESTORE_INTENT_KIND_BLOCK = "block";
const RESTORE_INTENT_KIND_EDGE_END = "edge-end";
const READER_MEASUREMENT_STATUS_FAILED = "failed";
const READER_PAGE_RESOLUTION_BLOCK_START = "block-start";
const READER_PAGE_RESOLUTION_EXACT = "exact";
const READER_PAGE_RESOLUTION_MISSING_BLOCK = "missing-block";

export type PaginationDecisionInput = {
  activeChapterId: string;
  consumedRestoreIntentKey: string | null;
  currentPageIndex: number;
  keepRestorePinned: boolean;
  measurementStatus: "failed" | "pending" | "ready";
  pageCount: number;
  restoreIntent: RestoreIntent | null;
  restorePageResolution: ReaderMeasurementPageResolution | null;
  visibleLocatorChapterId: string | null;
  visiblePageResolution: ReaderMeasurementPageResolution | null;
};

export type PaginationDecision = {
  nextPageIndex: number;
  shouldConsumeRestoreIntent: boolean;
  shouldWarnFailedMeasurement: boolean;
};

export function createPaginationLayoutKey(input: {
  chapterId: string;
  fontScale: number;
  libraryItemId: string;
  viewportHeight: number;
  viewportWidth: number;
}) {
  return [
    input.libraryItemId,
    input.chapterId,
    input.viewportWidth,
    input.viewportHeight,
    input.fontScale,
  ].join(":");
}

export function resolvePaginationDecision(
  input: PaginationDecisionInput,
): PaginationDecision {
  const maximumPageIndex = Math.max(0, input.pageCount - 1);
  let nextPageIndex = clamp(input.currentPageIndex, 0, maximumPageIndex);
  let shouldConsumeRestoreIntent = false;
  let shouldWarnFailedMeasurement = false;
  const restoreIntent = input.restoreIntent;

  if (
    restoreIntent &&
    hasPendingRestoreIntent(
      restoreIntent,
      input.activeChapterId,
      input.consumedRestoreIntentKey,
    )
  ) {
    if (input.measurementStatus === READER_MEASUREMENT_STATUS_FAILED) {
      shouldWarnFailedMeasurement = true;
      nextPageIndex =
        restoreIntent.kind === RESTORE_INTENT_KIND_EDGE_END
          ? maximumPageIndex
          : 0;
      shouldConsumeRestoreIntent = true;

      return {
        nextPageIndex,
        shouldConsumeRestoreIntent,
        shouldWarnFailedMeasurement,
      };
    }

    if (restoreIntent.kind === RESTORE_INTENT_KIND_BLOCK) {
      if (
        input.restorePageResolution?.status ===
          READER_PAGE_RESOLUTION_BLOCK_START ||
        input.restorePageResolution?.status === READER_PAGE_RESOLUTION_EXACT
      ) {
        nextPageIndex = clamp(
          input.restorePageResolution.pageIndex,
          0,
          maximumPageIndex,
        );
      } else if (
        input.restorePageResolution?.status ===
        READER_PAGE_RESOLUTION_MISSING_BLOCK
      ) {
        nextPageIndex = 0;
      } else {
        // Includes unresolved/null resolution; preserve fallback-to-start behavior.
        nextPageIndex = 0;
      }

      shouldConsumeRestoreIntent = true;

      return {
        nextPageIndex,
        shouldConsumeRestoreIntent,
        shouldWarnFailedMeasurement,
      };
    }

    nextPageIndex =
      restoreIntent.kind === RESTORE_INTENT_KIND_EDGE_END
        ? maximumPageIndex
        : 0;
    shouldConsumeRestoreIntent = true;

    return {
      nextPageIndex,
      shouldConsumeRestoreIntent,
      shouldWarnFailedMeasurement,
    };
  }

  if (
    input.keepRestorePinned &&
    restoreIntent?.chapterId === input.activeChapterId &&
    isStickyRestoreIntent(restoreIntent)
  ) {
    nextPageIndex =
      restoreIntent.kind === RESTORE_INTENT_KIND_EDGE_END
        ? maximumPageIndex
        : 0;

    return {
      nextPageIndex,
      shouldConsumeRestoreIntent,
      shouldWarnFailedMeasurement,
    };
  }

  if (
    input.measurementStatus === "ready" &&
    input.visibleLocatorChapterId === input.activeChapterId &&
    (input.visiblePageResolution?.status ===
      READER_PAGE_RESOLUTION_BLOCK_START ||
      input.visiblePageResolution?.status === READER_PAGE_RESOLUTION_EXACT)
  ) {
    nextPageIndex = clamp(input.visiblePageResolution.pageIndex, 0, maximumPageIndex);

    return {
      nextPageIndex,
      shouldConsumeRestoreIntent,
      shouldWarnFailedMeasurement,
    };
  }

  if (input.measurementStatus === READER_MEASUREMENT_STATUS_FAILED) {
    shouldWarnFailedMeasurement = true;
  }

  return {
    nextPageIndex,
    shouldConsumeRestoreIntent,
    shouldWarnFailedMeasurement,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
