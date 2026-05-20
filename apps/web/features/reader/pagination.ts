import {
  hasPendingRestoreIntent,
  isStickyRestoreIntent,
} from "./navigation";
import type { RestoreIntent } from "./navigation";
import type { ReaderMeasurementPageResolution } from "./measurement";

const RESTORE_INTENT_KIND_BLOCK = "block";
const RESTORE_INTENT_KIND_EDGE_END = "edge-end";
const READER_MEASUREMENT_STATUS_FAILED = "failed";
const READER_PAGE_RESOLUTION_BLOCK_START = "block-start";
const READER_PAGE_RESOLUTION_EXACT = "exact";

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

/**
 * resolvePaginationDecision is a decision engine that answers one question:
 * “Given everything we know (current page, restore intent, measurement results),
 * what page should the reader show next?”
 * It returns 3 things:
 * - nextPageIndex → which page to display
 * - shouldConsumeRestoreIntent → whether we should “use up” the restore instruction
 * - shouldWarnFailedMeasurement → whether something went wrong and should be signaled
 */
export function resolvePaginationDecision(
  input: PaginationDecisionInput,
): PaginationDecision {
  const maximumPageIndex = Math.max(0, input.pageCount - 1);

  let nextPageIndex = clamp(input.currentPageIndex, 0, maximumPageIndex);
  let shouldConsumeRestoreIntent = false;
  let shouldWarnFailedMeasurement = false;

  const { restoreIntent } = input;

  const hasPending =
    restoreIntent &&
    hasPendingRestoreIntent(
      restoreIntent,
      input.activeChapterId,
      input.consumedRestoreIntentKey,
    );

  const resolveEdge = () =>
    restoreIntent
      ? resolveEdgePage(restoreIntent.kind, maximumPageIndex)
      : 0;

  // --- 1. HANDLE RESTORE INTENT (highest priority)
  if (hasPending && restoreIntent) {
    shouldConsumeRestoreIntent = true;

    if (input.measurementStatus === READER_MEASUREMENT_STATUS_FAILED) {
      shouldWarnFailedMeasurement = true;
      nextPageIndex = resolveEdge();
      return finalize();
    }

    if (restoreIntent.kind === RESTORE_INTENT_KIND_BLOCK) {
      const status = input.restorePageResolution?.status;

      if (
        status === READER_PAGE_RESOLUTION_BLOCK_START ||
        status === READER_PAGE_RESOLUTION_EXACT
      ) {
        nextPageIndex = clamp(
          input.restorePageResolution!.pageIndex,
          0,
          maximumPageIndex,
        );
      } else {
        nextPageIndex = 0;
      }

      return finalize();
    }

    // edge intent
    nextPageIndex = resolveEdge();
    return finalize();
  }

  // --- 2. STICKY RESTORE (does NOT consume)
  if (
    input.keepRestorePinned &&
    restoreIntent?.chapterId === input.activeChapterId &&
    isStickyRestoreIntent(restoreIntent)
  ) {
    nextPageIndex = resolveEdge();
    return finalize();
  }

  // --- 3. USE VISIBLE MEASUREMENT
  if (
    input.measurementStatus === "ready" &&
    input.visibleLocatorChapterId === input.activeChapterId
  ) {
    const status = input.visiblePageResolution?.status;

    if (
      status === READER_PAGE_RESOLUTION_BLOCK_START ||
      status === READER_PAGE_RESOLUTION_EXACT
    ) {
      nextPageIndex = clamp(
        input.visiblePageResolution!.pageIndex,
        0,
        maximumPageIndex,
      );
      return finalize();
    }
  }

  // --- 4. FAILURE WARNING ONLY
  if (input.measurementStatus === READER_MEASUREMENT_STATUS_FAILED) {
    shouldWarnFailedMeasurement = true;
  }

  return finalize();

  function finalize(): PaginationDecision {
    return {
      nextPageIndex,
      shouldConsumeRestoreIntent,
      shouldWarnFailedMeasurement,
    };
  }
}

function resolveEdgePage(kind: string, max: number) {
  return kind === RESTORE_INTENT_KIND_EDGE_END ? max : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
