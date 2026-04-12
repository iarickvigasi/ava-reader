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

export type ReaderScreenProps = {
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
  persistenceMode?: "local-only" | "remote";
};

export type PageBoxSize = {
  height: number;
  width: number;
};

export type ReadyReaderPayload = Extract<ReaderStatusPayload, { status: "READY" }>;

export type InitialResumeBootstrapState = {
  phase: "selecting" | "applying" | "applied";
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
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  pendingChapterId: string | null;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
};

export type ReaderScreenControllerInput = {
  initialPayload: ReaderStatusPayload;
  libraryItemId: string;
  persistenceMode: "local-only" | "remote";
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
