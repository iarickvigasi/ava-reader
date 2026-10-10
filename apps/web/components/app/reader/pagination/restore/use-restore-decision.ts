import { restoreSucceeded } from "./restore-succeeded";
import { useReaderNavigationActions } from "../../state/reader-navigation-context";
import { useLayoutEffect } from "react";
import { useRestorePositionPin } from "./use-restore-position-pin";
import { READER_MEASUREMENT_STATUS_PENDING } from "../measurement/resolve-measurement";
import { resolveRestoreStep } from "./resolve-restore-step";
import { useRenderSyncedRef } from "./use-render-synced-ref";
import type { UseRestoreDecisionInput } from "./use-restore-controller.types";

/** Restores exact navigation targets or the stable passage across reflow. */
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
  const navigation = useReaderNavigationActions();
  const navigationRef = useRenderSyncedRef(navigation);
  const positionRef = useRestorePositionPin({
    activeChapterId: activeChapter.chapterId,
    cancelSettle,
    currentPageIndex,
    restoreIntent,
  });
  const restoreIntentRef = useRenderSyncedRef(restoreIntent);
  const visibleLocatorRef = useRenderSyncedRef(visibleLocator);
  const currentPageIndexRef = useRenderSyncedRef(currentPageIndex);

  useLayoutEffect(() => {
    if (
      !activePaginationLayoutKey ||
      !activeMeasurementEntry ||
      activeMeasurementEntry.status === READER_MEASUREMENT_STATUS_PENDING
    ) {
      return;
    }
    const currentRestoreIntent = restoreIntentRef.current;
    const position = positionRef.current;
    const visible = visibleLocatorRef.current;
    if (
      !position.visibleAnchor &&
      visible?.chapterId === activeChapter.chapterId
    )
      position.visibleAnchor = visible;
    const { decision, keepRestorePinned } = resolveRestoreStep({
      activeChapterId: activeChapter.chapterId,
      consumedRestoreIntentKey: position.consumedKey,
      currentPageIndex: currentPageIndexRef.current,
      isStickyRestorePinned: position.sticky,
      lastAppliedRestorePageIndex: position.restorePage,
      measurementEntry: activeMeasurementEntry,
      pageCount,
      prefixPageCount,
      restoreIntent: currentRestoreIntent,
      visibleLocator: position.visibleAnchor,
    });
    position.sticky = keepRestorePinned;
    position.appliedPage = decision.nextPageIndex;
    if (decision.shouldWarnFailedMeasurement) {
      warnFailedMeasurement(activeMeasurementEntry.layoutKey);
    }
    setCurrentPageIndex((current) =>
      current === decision.nextPageIndex ? current : decision.nextPageIndex,
    );
    if (currentRestoreIntent && decision.shouldConsumeRestoreIntent) {
      position.consumedKey = currentRestoreIntent.key;
      position.restorePage = decision.nextPageIndex;
    }
    scheduleSettle(activeRestoreCycleKey, () => {
      if (currentRestoreIntent && decision.shouldConsumeRestoreIntent)
        navigationRef.current?.settle(
          currentRestoreIntent,
          restoreSucceeded(currentRestoreIntent, activeMeasurementEntry),
        );
    });
  }, [
    activeChapter.chapterId,
    activeMeasurementEntry,
    activePaginationLayoutKey,
    activeRestoreCycleKey,
    currentPageIndexRef,
    pageCount,
    prefixPageCount,
    navigationRef,
    positionRef,
    restoreIntentRef,
    scheduleSettle,
    setCurrentPageIndex,
    visibleLocatorRef,
    warnFailedMeasurement,
  ]);
}
