import type {
  ReaderChapterPayload,
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  RestoreIntent,
} from "@/lib/reader-navigation";
import type { ReaderResumeSnapshot } from "@/lib/reader-resume";
import {
  READER_STATUS_READY,
  type ReaderPersistenceMode,
  type ReaderResumePhase,
} from "./constants";

export type ReaderScreenProps = {
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
  persistenceMode?: ReaderPersistenceMode;
};

export type PageBoxSize = {
  height: number;
  width: number;
};

export type ReadyReaderPayload = Extract<
  ReaderStatusPayload,
  { status: typeof READER_STATUS_READY }
>;

export type ReadyReaderTocEntry = ReadyReaderPayload["toc"][number];

export type InitialResumeBootstrapState = {
  phase: ReaderResumePhase;
  snapshot: ReaderResumeSnapshot | null;
};

export type ReadyReaderProps = {
  activeChapter: ReaderChapterPayload;
  displayLocator: ReaderLocator | null;
  fontScale: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
  libraryItemId: string;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
  payload: Extract<
    ReaderStatusPayload,
    { status: typeof READER_STATUS_READY }
  >;
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
};

export type ReaderScreenControllerInput = {
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
  persistenceMode: ReaderPersistenceMode;
};

export type ReaderScreenControllerResult = {
  activeChapter: ReaderChapterPayload | null;
  displayLocator: ReaderLocator | null;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isRefreshingWindow: boolean;
  navigateToChapter: (
    chapterId: string,
    target?: ReaderNavigationTarget,
  ) => void;
  payload: ReaderStatusPayload;
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
  setVisibleLocator: (locator: ReaderLocator | null) => void;
  visibleLocator: ReaderLocator | null;
};
