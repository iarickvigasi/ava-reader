import { useEffect, useMemo } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { ReaderArticle } from "../content/reader-article";
import { ReaderPaginationPreloader } from "../pagination/measurement/reader-pagination-preloader";
import { ReadyReaderProgress } from "./ready-reader-progress";
import { ReaderFrame } from "./reader-frame";
import { ReaderPageViewport } from "./reader-page-viewport";
import {
  READER_PANEL_AI_CHATS,
  READER_PANEL_AI_COMMENTS,
  READER_PANEL_AI_TOOLBOX,
  READER_PANEL_CONTENTS,
  READER_PANEL_HIGHLIGHTS,
  READER_PANEL_PREFERENCES,
  READER_VISIBILITY_HIDDEN,
} from "../shared/constants";
import type { ReadyReaderProps } from "../shared/types";
import { useReaderPagination } from "../pagination/use-reader-pagination";
import { useHighlightSelectionBridge } from "../selection/use-highlight-selection-bridge";
import { useReaderTextSelection } from "../selection/use-reader-text-selection";
import { IosSelectionOverlay } from "../selection/ios/ios-selection-overlay";
import { useIosSelection } from "../selection/ios/use-ios-selection";

export function ReadyReader({
  activeChapter,
  fontScale,
  isBootstrapping,
  isLoadingChapter,
  isRefreshingWindow,
  libraryItemId,
  onSelectChapter,
  onVisibleLocatorChange,
  payload,
  restoreIntent,
  visibleLocator,
  embedded = false,
}: ReadyReaderProps & { embedded?: boolean }) {
  const { activePanel } = useReaderUi();
  const isContentsOpen = activePanel === READER_PANEL_CONTENTS;
  const isPreferencesOpen = activePanel === READER_PANEL_PREFERENCES;
  const isAiChatsOpen = activePanel === READER_PANEL_AI_CHATS;
  const isHighlightsOpen = activePanel === READER_PANEL_HIGHLIGHTS;
  const isAiCommentsOpen = activePanel === READER_PANEL_AI_COMMENTS;
  const isAiToolboxOpen = activePanel === READER_PANEL_AI_TOOLBOX;
  const isPanelOpen =
    isContentsOpen ||
    isPreferencesOpen ||
    isAiChatsOpen ||
    isHighlightsOpen ||
    isAiCommentsOpen ||
    isAiToolboxOpen;

  // Look up the immediate neighbours so the spread logic can fill column 2
  // with the next chapter when the active chapter is single-page, and skip
  // the active chapter's column 1 when the previous chapter was single-page
  // (since the user already saw it in that previous chapter's spread).
  const previousChapter = useMemo(
    () =>
      payload.chapters.find(
        (chapter) => chapter.chapterId === activeChapter.previousChapterId,
      ) ?? null,
    [activeChapter.previousChapterId, payload.chapters],
  );
  const nextChapter = useMemo(
    () =>
      payload.chapters.find(
        (chapter) => chapter.chapterId === activeChapter.nextChapterId,
      ) ?? null,
    [activeChapter.nextChapterId, payload.chapters],
  );

  const {
    articleStyle,
    availableHeight,
    currentPageIndex,
    handleTouchEnd,
    handleTouchStart,
    pageBoxRef,
    pageBoxSize,
    pageCount,
    prefixBlocks,
    rootRef,
    shouldMaskArticle,
    spilloverBlocks,
    storeMeasurementEntry,
  } = useReaderPagination({
    activeChapter,
    fontScale,
    isBootstrapping,
    isLoadingChapter,
    isPanelOpen,
    libraryItemId,
    nextChapter,
    onSelectChapter,
    onVisibleLocatorChange,
    previousChapter,
    restoreIntent,
    visibleLocator,
  });

  // Bridges fresh selections and clicks on painted highlights into the AI
  // Comments panel, matching to existing rows when possible. Owns the
  // highlight-store reads, so this component stays focused on layout.
  const { onTextSelected, onHighlightClick, onAiCommentClick } =
    useHighlightSelectionBridge(activeChapter.chapterId);

  useReaderTextSelection({
    containerRef: pageBoxRef,
    onSelectText: onTextSelected,
    // Selecting while the article is masked (e.g., during chapter transitions)
    // would surface stale text — skip those windows.
    disabled: shouldMaskArticle,
  });

  // iOS uses app-owned selection gestures and paint (spec 2.6 Behaviour 8).
  const { isActive: isIosSelection, rects: iosSelectionRects } =
    useIosSelection({
      bookLanguage: payload.book.language,
      containerRef: pageBoxRef,
      onSelectText: onTextSelected,
      disabled: shouldMaskArticle,
      pageKey: `${libraryItemId}:${activeChapter.chapterId}:${currentPageIndex}`,
    });

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = READER_VISIBILITY_HIDDEN;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPanelOpen]);

  return (
    <>
      <ReaderFrame
        rootRef={rootRef}
        height={availableHeight}
        activeChapter={activeChapter}
        embedded={embedded}
        payload={payload}
        isBootstrapping={isBootstrapping}
        isLoadingChapter={isLoadingChapter}
        isRefreshingWindow={isRefreshingWindow}
      >
        <ReaderPageViewport
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
          embedded={embedded}
        >
          {/* Must NOT clip: its edge coincides exactly with the column
                  edge, so any overflow-hidden here re-amputates edge ink. */}
          <div
            ref={pageBoxRef}
            className={
              isIosSelection ? "h-full w-full select-none" : "h-full w-full"
            }
          >
            <ReaderArticle
              applyAiComments
              blocks={activeChapter.blocks}
              chapterId={activeChapter.chapterId}
              onAiCommentClick={onAiCommentClick}
              onHighlightClick={onHighlightClick}
              pageHeight={pageBoxSize.height}
              prefixBlocks={prefixBlocks}
              prefixChapterId={previousChapter?.chapterId ?? null}
              spilloverBlocks={spilloverBlocks}
              spilloverChapterId={nextChapter?.chapterId ?? null}
              style={articleStyle}
            />
          </div>
          {shouldMaskArticle ? (
            <div className="pointer-events-none absolute inset-0 bg-paper/55 backdrop-blur-[2px]" />
          ) : null}
        </ReaderPageViewport>

        {!embedded && (
          <ReadyReaderProgress
            completionPercent={payload.progress.completionPercent}
            currentPageIndex={currentPageIndex}
            pageCount={pageCount}
          />
        )}
      </ReaderFrame>

      <IosSelectionOverlay rects={iosSelectionRects} />

      {pageBoxSize.width > 0 && pageBoxSize.height > 0 ? (
        <ReaderPaginationPreloader
          chapters={payload.chapters}
          fontScale={fontScale}
          libraryItemId={libraryItemId}
          onMeasurement={storeMeasurementEntry}
          pageBoxHeight={pageBoxSize.height}
          pageBoxWidth={pageBoxSize.width}
        />
      ) : null}
    </>
  );
}
