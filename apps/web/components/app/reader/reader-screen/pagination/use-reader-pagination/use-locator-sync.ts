import { useEffect, useRef } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import type { ReaderRestorePhase } from "../use-reader-pagination.helpers";
import { resolveVisibleLocatorPublishDecision } from "../use-reader-pagination.helpers";

export function useLocatorSync({
  currentPageIndex,
  activeReadyMeasurementEntry,
  isBootstrapping,
  prefixPageCount,
  restorePhase,
  visibleLocator,
  onVisibleLocatorChange,
}: {
  currentPageIndex: number;
  activeReadyMeasurementEntry: Extract<
    ReaderMeasurementEntry,
    { status: "ready" }
  > | null;
  isBootstrapping: boolean;
  prefixPageCount: number;
  restorePhase: ReaderRestorePhase;
  visibleLocator: ReaderLocator | null;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
}) {
  const onVisibleLocatorChangeRef = useRef(onVisibleLocatorChange);
  const visibleLocatorRef = useRef(visibleLocator);

  useEffect(() => {
    onVisibleLocatorChangeRef.current = onVisibleLocatorChange;
  }, [onVisibleLocatorChange]);

  useEffect(() => {
    visibleLocatorRef.current = visibleLocator;
  }, [visibleLocator]);

  useEffect(() => {
    const locatorPublishDecision = resolveVisibleLocatorPublishDecision({
      activeReadyMeasurementEntry,
      currentPageIndex,
      isBootstrapping,
      prefixPageCount,
      restorePhase,
      visibleLocator: visibleLocatorRef.current,
    });

    if (
      !locatorPublishDecision.shouldPublishLocator ||
      !locatorPublishDecision.nextLocator
    ) {
      return;
    }

    onVisibleLocatorChangeRef.current({
      blockId: locatorPublishDecision.nextLocator.blockId,
      chapterId: locatorPublishDecision.nextLocator.chapterId,
      textOffset: locatorPublishDecision.nextLocator.textOffset,
    });
  }, [
    activeReadyMeasurementEntry,
    currentPageIndex,
    isBootstrapping,
    prefixPageCount,
    restorePhase,
  ]);
}
