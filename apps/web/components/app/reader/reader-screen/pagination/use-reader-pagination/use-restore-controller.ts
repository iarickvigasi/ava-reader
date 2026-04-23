import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReaderChapterPayload, ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "@/lib/reader-navigation";
import { isStickyRestoreIntent } from "@/lib/reader-navigation";
import { resolvePaginationDecision } from "@/lib/reader-pagination";
import type { ReaderMeasurementEntry } from "@/lib/reader-measurement";
import { createLocatorFromRestoreIntent } from "../../shared/utils";
import {
  READER_MEASUREMENT_STATUS_PENDING,
  resolvePageResolutionForLocator,
  resolveReadyMeasurementEntry,
  resolveRestorePhase,
} from "../use-reader-pagination.helpers";
import type { ReaderRestorePhase } from "../use-reader-pagination.helpers";

export function useRestoreController({
  activePaginationLayoutKey,
  activeMeasurementEntry,
  activeChapter,
  restoreIntent,
  pageCount,
  currentPageIndex,
  setCurrentPageIndex,
  warnFailedMeasurement,
  activeRestoreCycleKey,
  visibleLocator,
}: {
  activePaginationLayoutKey: string | null;
  activeMeasurementEntry: ReaderMeasurementEntry | null;
  activeChapter: ReaderChapterPayload;
  restoreIntent: RestoreIntent | null;
  pageCount: number;
  currentPageIndex: number;
  setCurrentPageIndex: (update: number | ((prev: number) => number)) => void;
  warnFailedMeasurement: (layoutKey: string) => void;
  activeRestoreCycleKey: string;
  visibleLocator: ReaderLocator | null;
}): ReaderRestorePhase {
  const consumedRestoreIntentKeyRef = useRef<string | null>(null);
  const keepCommittedRestorePinnedRef = useRef(false);
  const settleRestoreFrameRef = useRef<number | null>(null);
  const [settledRestoreCycleKey, setSettledRestoreCycleKey] = useState<
    string | null
  >(null);

  const restoreIntentRef = useRef(restoreIntent);
  const visibleLocatorRef = useRef(visibleLocator);
  const currentPageIndexRef = useRef(currentPageIndex);

  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  useEffect(() => {
    visibleLocatorRef.current = visibleLocator;
  }, [visibleLocator]);

  useEffect(() => {
    restoreIntentRef.current = restoreIntent;
  }, [restoreIntent]);

  useEffect(() => {
    return () => {
      if (settleRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(settleRestoreFrameRef.current);
      }
    };
  }, []);

  const restorePhase = resolveRestorePhase({
    activeMeasurementStatus: activeMeasurementEntry?.status ?? "pending",
    activeRestoreCycleKey,
    settledRestoreCycleKey,
  });

  useLayoutEffect(() => {
    if (settleRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(settleRestoreFrameRef.current);
      settleRestoreFrameRef.current = null;
    }

    consumedRestoreIntentKeyRef.current = null;
    keepCommittedRestorePinnedRef.current = isStickyRestoreIntent(restoreIntent);
  }, [activeChapter.chapterId, restoreIntent]);

  useLayoutEffect(() => {
    if (!activePaginationLayoutKey || !activeMeasurementEntry) {
      return;
    }

    if (activeMeasurementEntry.status === READER_MEASUREMENT_STATUS_PENDING) {
      return;
    }

    const currentRestoreIntent = restoreIntentRef.current;
    const readyMeasurementEntry =
      resolveReadyMeasurementEntry(activeMeasurementEntry);
    const visibleLocator = visibleLocatorRef.current;

    const restorePageResolution = resolvePageResolutionForLocator({
      activeChapterId: activeChapter.chapterId,
      locator: createLocatorFromRestoreIntent(currentRestoreIntent),
      measurementEntry: readyMeasurementEntry,
    });
    const visiblePageResolution = resolvePageResolutionForLocator({
      activeChapterId: activeChapter.chapterId,
      locator: visibleLocator,
      measurementEntry: readyMeasurementEntry,
    });
    const decision = resolvePaginationDecision({
      activeChapterId: activeChapter.chapterId,
      consumedRestoreIntentKey: consumedRestoreIntentKeyRef.current,
      currentPageIndex: currentPageIndexRef.current,
      keepRestorePinned: keepCommittedRestorePinnedRef.current,
      measurementStatus: activeMeasurementEntry.status,
      pageCount,
      restoreIntent: currentRestoreIntent,
      restorePageResolution,
      visibleLocatorChapterId: visibleLocator?.chapterId ?? null,
      visiblePageResolution,
    });

    if (decision.shouldWarnFailedMeasurement) {
      warnFailedMeasurement(activeMeasurementEntry.layoutKey);
    }

    setCurrentPageIndex((current) =>
      current === decision.nextPageIndex ? current : decision.nextPageIndex,
    );

    if (currentRestoreIntent && decision.shouldConsumeRestoreIntent) {
      consumedRestoreIntentKeyRef.current = currentRestoreIntent.key;
    }

    if (settleRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(settleRestoreFrameRef.current);
    }

    settleRestoreFrameRef.current = window.requestAnimationFrame(() => {
      settleRestoreFrameRef.current = null;
      setSettledRestoreCycleKey(activeRestoreCycleKey);
    });
  }, [
    activeChapter.chapterId,
    activeMeasurementEntry,
    activePaginationLayoutKey,
    activeRestoreCycleKey,
    pageCount,
    setCurrentPageIndex,
    warnFailedMeasurement,
  ]);

  return restorePhase;
}
