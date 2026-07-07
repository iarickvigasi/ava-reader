import type { ReaderLocator } from "@/lib/api-types";
import {
  READER_RESTORE_PHASE_SETTLED,
  type ReaderRestorePhase,
} from "./use-reader-pagination/use-restore-controller/restore-phase";
import type { ReadyReaderMeasurementEntry } from "./resolve-measurement";

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
  // When > 0 the active chapter's first visible spread starts at the
  // preloader spread's right column (prefix content occupies the left
  // column). Publishing must search from that shifted start so the saved
  // locator points to content the user is actually viewing.
  prefixPageCount: number;
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

  const columnOffset: 1 | 2 = input.prefixPageCount > 0 ? 2 : 1;
  const nextLocator = input.activeReadyMeasurementEntry.resolveLocator(
    input.currentPageIndex,
    columnOffset,
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
