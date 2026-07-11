import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "@/features/reader/navigation";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import {
  resolvePaginationDecision,
  type PaginationDecision,
} from "@/features/reader/pagination";
import { createLocatorFromRestoreIntent } from "../../shared/utils";
import {
  resolvePageResolutionForLocator,
  resolveReadyMeasurementEntry,
} from "../measurement/resolve-measurement";
import { applyPrefixColumnShift } from "./apply-prefix-column-shift";
import { shouldKeepStickyRestorePinned } from "./restore-pin";

/**
 * Pure core of the restore decision: given the current measurement, restore
 * intent, visible locator and page state, decide which page to show, whether to
 * consume the intent, and whether the sticky edge pin should stay active. The
 * controller reads live refs, calls this, then applies the result imperatively.
 */
export function resolveRestoreStep(input: {
  activeChapterId: string;
  consumedRestoreIntentKey: string | null;
  currentPageIndex: number;
  isStickyRestorePinned: boolean;
  lastAppliedRestorePageIndex: number | null;
  // The active chapter's measurement entry, already known to be non-pending.
  measurementEntry: ReaderMeasurementEntry;
  pageCount: number;
  prefixPageCount: number;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
}): { decision: PaginationDecision; keepRestorePinned: boolean } {
  const readyMeasurementEntry = resolveReadyMeasurementEntry(
    input.measurementEntry,
  );

  const restorePageResolution = applyPrefixColumnShift(
    resolvePageResolutionForLocator({
      activeChapterId: input.activeChapterId,
      locator: createLocatorFromRestoreIntent(input.restoreIntent),
      measurementEntry: readyMeasurementEntry,
    }),
    input.prefixPageCount,
  );
  const visiblePageResolution = applyPrefixColumnShift(
    resolvePageResolutionForLocator({
      activeChapterId: input.activeChapterId,
      locator: input.visibleLocator,
      measurementEntry: readyMeasurementEntry,
    }),
    input.prefixPageCount,
  );

  // While the user is still on the page the last restore produced, treat the
  // intent as unconsumed so a corrected measurement (e.g. after fonts load and
  // layout shifts) can re-place them.
  const userStillOnRestoredPage =
    input.lastAppliedRestorePageIndex !== null &&
    input.currentPageIndex === input.lastAppliedRestorePageIndex;

  // Release the sticky edge pin once the reader has paged away from where the
  // restore placed them, so a relayout/re-measure preserves their position
  // instead of snapping back to the chapter edge.
  const keepRestorePinned = shouldKeepStickyRestorePinned({
    currentPageIndex: input.currentPageIndex,
    isStickyRestorePinned: input.isStickyRestorePinned,
    lastAppliedRestorePageIndex: input.lastAppliedRestorePageIndex,
  });

  const decision = resolvePaginationDecision({
    activeChapterId: input.activeChapterId,
    consumedRestoreIntentKey: userStillOnRestoredPage
      ? null
      : input.consumedRestoreIntentKey,
    currentPageIndex: input.currentPageIndex,
    keepRestorePinned,
    measurementStatus: input.measurementEntry.status,
    pageCount: input.pageCount,
    restoreIntent: input.restoreIntent,
    restorePageResolution,
    visibleLocatorChapterId: input.visibleLocator?.chapterId ?? null,
    visiblePageResolution,
  });

  return { decision, keepRestorePinned };
}
