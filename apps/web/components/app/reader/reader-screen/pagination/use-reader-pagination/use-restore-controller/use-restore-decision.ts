import { useLayoutEffect, useRef } from "react";
import { isStickyRestoreIntent } from "@/features/reader/navigation";
import { READER_MEASUREMENT_STATUS_PENDING } from "../../resolve-measurement";
import { resolveRestoreStep } from "./resolve-restore-step";
import { useRenderSyncedRef } from "./use-render-synced-ref";
import type { UseRestoreDecisionInput } from "./use-restore-controller.types";

/**
 * Owns the restore refs and the two layout effects that decide which page to
 * show. Reads live values through render-synced refs so a page step doesn't
 * re-run the decision. Split out of useRestoreController to keep files small.
 */
export function useRestoreDecision({
  activePaginationLayoutKey,
  activeMeasurementEntry,
  activeChapter,
  prefixPageCount,
  restoreIntent,
  pageCount,
  currentPageIndex,
  setCurrentPageIndex,
  warnFailedMeasurement,
  activeRestoreCycleKey,
  visibleLocator,
  cancelSettle,
  scheduleSettle,
}: UseRestoreDecisionInput) {
  const consumedRestoreIntentKeyRef = useRef<string | null>(null);
  const keepCommittedRestorePinnedRef = useRef(false);
  // Page the last restore placed the user on; reset on intent/chapter change.
  const lastAppliedRestorePageIndexRef = useRef<number | null>(null);

  // Mirror the latest values into refs so the decision effect reads them without
  // depending on them (it must not re-run on every page step).
  const restoreIntentRef = useRenderSyncedRef(restoreIntent);
  const visibleLocatorRef = useRenderSyncedRef(visibleLocator);
  const currentPageIndexRef = useRenderSyncedRef(currentPageIndex);

  useLayoutEffect(() => {
    cancelSettle();
    consumedRestoreIntentKeyRef.current = null;
    keepCommittedRestorePinnedRef.current = isStickyRestoreIntent(restoreIntent);
    lastAppliedRestorePageIndexRef.current = null;
  }, [activeChapter.chapterId, cancelSettle, restoreIntent]);

  useLayoutEffect(() => {
    if (
      !activePaginationLayoutKey ||
      !activeMeasurementEntry ||
      activeMeasurementEntry.status === READER_MEASUREMENT_STATUS_PENDING
    ) {
      return;
    }

    const currentRestoreIntent = restoreIntentRef.current;
    const { decision, keepRestorePinned } = resolveRestoreStep({
      activeChapterId: activeChapter.chapterId,
      consumedRestoreIntentKey: consumedRestoreIntentKeyRef.current,
      currentPageIndex: currentPageIndexRef.current,
      isStickyRestorePinned: keepCommittedRestorePinnedRef.current,
      lastAppliedRestorePageIndex: lastAppliedRestorePageIndexRef.current,
      measurementEntry: activeMeasurementEntry,
      pageCount,
      prefixPageCount,
      restoreIntent: currentRestoreIntent,
      visibleLocator: visibleLocatorRef.current,
    });

    keepCommittedRestorePinnedRef.current = keepRestorePinned;

    if (decision.shouldWarnFailedMeasurement) {
      warnFailedMeasurement(activeMeasurementEntry.layoutKey);
    }

    setCurrentPageIndex((current) =>
      current === decision.nextPageIndex ? current : decision.nextPageIndex,
    );

    if (currentRestoreIntent && decision.shouldConsumeRestoreIntent) {
      consumedRestoreIntentKeyRef.current = currentRestoreIntent.key;
      lastAppliedRestorePageIndexRef.current = decision.nextPageIndex;
    }

    scheduleSettle(activeRestoreCycleKey);
  }, [
    activeChapter.chapterId,
    activeMeasurementEntry,
    activePaginationLayoutKey,
    activeRestoreCycleKey,
    currentPageIndexRef,
    pageCount,
    prefixPageCount,
    restoreIntentRef,
    scheduleSettle,
    setCurrentPageIndex,
    visibleLocatorRef,
    warnFailedMeasurement,
  ]);
}
