import type {
  CSSProperties,
  RefObject,
  TouchEvent as ReactTouchEvent,
} from "react";
import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderLocator,
} from "@/lib/api-types";
import type {
  ReaderNavigationTarget,
  RestoreIntent,
} from "@/features/reader/navigation";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import type { PageBoxSize } from "../shared/types";

export type UseReaderPaginationInput = {
  activeChapter: ReaderChapterPayload;
  fontScale: number;
  isBootstrapping: boolean;
  isLoadingChapter: boolean;
  isPanelOpen: boolean;
  libraryItemId: string;
  // Previous chapter — when single-page in two-column mode, its blocks are
  // surfaced as `prefixBlocks` so the active chapter starts in column 2.
  previousChapter?: ReaderChapterPayload | null;
  // Next chapter — when the active chapter is single-page in two-column mode,
  // its blocks are surfaced as `spilloverBlocks` so column 2 isn't wasted.
  nextChapter?: ReaderChapterPayload | null;
  onSelectChapter: (chapterId: string, target?: ReaderNavigationTarget) => void;
  onVisibleLocatorChange: (locator: ReaderLocator | null) => void;
  restoreIntent: RestoreIntent | null;
  visibleLocator: ReaderLocator | null;
};

export type UseReaderPaginationResult = {
  articleStyle: CSSProperties;
  availableHeight: number;
  currentPageIndex: number;
  handleTouchEnd: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  pageBoxRef: RefObject<HTMLDivElement | null>;
  pageBoxSize: PageBoxSize;
  pageCount: number;
  // Previous chapter's blocks to render before the active chapter (spread
  // column 1) when the previous chapter is single-page in two-column mode.
  prefixBlocks: ReaderBlock[] | undefined;
  rootRef: RefObject<HTMLDivElement | null>;
  shouldMaskArticle: boolean;
  // Next chapter's blocks to render after the active chapter (spread
  // column 2) when the active chapter is single-page in two-column mode.
  spilloverBlocks: ReaderBlock[] | undefined;
  storeMeasurementEntry: (entry: ReaderMeasurementEntry) => void;
};
