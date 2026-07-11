import type { ReaderChapterPayload, ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "@/features/reader/navigation";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";

export type UseRestoreControllerInput = {
  activePaginationLayoutKey: string | null;
  activeMeasurementEntry: ReaderMeasurementEntry | null;
  activeChapter: ReaderChapterPayload;
  // Number of preloader spreads that sit BEFORE the active chapter's first
  // visible spread (= 1 when a single-page previous chapter occupies column 1
  // of spread 0, otherwise 0). Used to translate preloader-space page
  // resolutions to the user's visible page when active-chapter content is
  // shifted by one column.
  prefixPageCount: number;
  restoreIntent: RestoreIntent | null;
  pageCount: number;
  currentPageIndex: number;
  setCurrentPageIndex: (update: number | ((prev: number) => number)) => void;
  warnFailedMeasurement: (layoutKey: string) => void;
  activeRestoreCycleKey: string;
  visibleLocator: ReaderLocator | null;
};

export type UseRestoreDecisionInput = UseRestoreControllerInput & {
  cancelSettle: () => void;
  scheduleSettle: (restoreCycleKey: string) => void;
};
