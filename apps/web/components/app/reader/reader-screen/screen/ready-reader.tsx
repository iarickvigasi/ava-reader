import { useEffect, useMemo } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { ReaderArticle } from "../content/reader-article";
import { ReaderPaginationPreloader } from "../pagination/reader-pagination-preloader";
import {
  ReadyReaderActivityStatus,
  ReadyReaderHeader,
  ReadyReaderProgress,
} from "./ready-reader-sections";
import { ReaderAiChatsOverlay } from "../overlays/ai-chats/reader-ai-chats-overlay";
import { ReaderAiCommentsOverlay } from "../overlays/ai-comments/reader-ai-comments-overlay";
import { ReaderContentsOverlay } from "../overlays/contents/reader-contents-overlay";
import { ReaderHighlightsOverlay } from "../overlays/highlights/reader-highlights-overlay";
import { ReaderPreferencesOverlay } from "../overlays/preferences/reader-preferences-overlay";
import {
  READER_PANEL_AI_CHATS,
  READER_PANEL_AI_COMMENTS,
  READER_PANEL_CONTENTS,
  READER_PANEL_HIGHLIGHTS,
  READER_PANEL_PREFERENCES,
  READER_VISIBILITY_HIDDEN,
} from "../shared/constants";
import type { ReadyReaderProps } from "../shared/types";
import { useReaderPagination } from "../pagination/use-reader-pagination";
import { useHighlightSelectionBridge } from "./use-highlight-selection-bridge";
import { useReaderTextSelection } from "./use-reader-text-selection";

export function ReadyReader({
  activeChapter,
  displayLocator,
  fontScale,
  isBootstrapping,
  isLoadingChapter,
  isRefreshingWindow,
  libraryItemId,
  onDecreaseFont,
  onIncreaseFont,
  onSelectChapter,
  onVisibleLocatorChange,
  payload,
  pendingChapterId,
  restoreIntent,
  visibleLocator,
}: ReadyReaderProps) {
  const { activePanel, closePanel } = useReaderUi();
  const isContentsOpen = activePanel === READER_PANEL_CONTENTS;
  const isPreferencesOpen = activePanel === READER_PANEL_PREFERENCES;
  const isAiChatsOpen = activePanel === READER_PANEL_AI_CHATS;
  const isHighlightsOpen = activePanel === READER_PANEL_HIGHLIGHTS;
  const isAiCommentsOpen = activePanel === READER_PANEL_AI_COMMENTS;
  const isPanelOpen =
    isContentsOpen ||
    isPreferencesOpen ||
    isAiChatsOpen ||
    isHighlightsOpen ||
    isAiCommentsOpen;

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
  const { onTextSelected } = useHighlightSelectionBridge(
    activeChapter.chapterId,
  );

  useReaderTextSelection({
    containerRef: pageBoxRef,
    onSelectText: onTextSelected,
    // Selecting while the article is masked (e.g., during chapter transitions)
    // would surface stale text — skip those windows.
    disabled: shouldMaskArticle,
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
      <div
        ref={rootRef}
        className="px-4 pb-5 pt-8 sm:px-6 md:px-7 md:pt-8 lg:px-8"
        style={{
          height: availableHeight > 0 ? `${availableHeight}px` : undefined,
        }}
      >
        <section className="mx-auto flex h-full max-w-312 min-w-0 flex-col">
          <div className="flex items-start justify-between gap-6">
            <ReadyReaderHeader activeChapter={activeChapter} payload={payload} />
            <ReadyReaderActivityStatus
              isBootstrapping={isBootstrapping}
              isLoadingChapter={isLoadingChapter}
              isRefreshingWindow={isRefreshingWindow}
            />
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 sm:mt-8">

            <div
              className="relative min-h-0 flex-1 overflow-hidden px-3 py-5 sm:px-5 sm:py-6 md:px-6"
              style={{
                touchAction: "none",
              }}
              onTouchEnd={handleTouchEnd}
              onTouchStart={handleTouchStart}
            >
              <div ref={pageBoxRef} className="h-full w-full overflow-hidden">
                <ReaderArticle
                  applyAiComments
                  blocks={activeChapter.blocks}
                  chapterId={activeChapter.chapterId}
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
            </div>

            <ReadyReaderProgress
              completionPercent={payload.progress.completionPercent}
              currentPageIndex={currentPageIndex}
              pageCount={pageCount}
            />
          </div>
        </section>
      </div>

      {isContentsOpen ? (
        <ReaderContentsOverlay
          activeChapterId={activeChapter.chapterId}
          activeLocator={displayLocator}
          onClose={closePanel}
          onSelectChapter={(chapterId, target) => {
            closePanel();
            onSelectChapter(chapterId, target);
          }}
          payload={payload}
          pendingChapterId={pendingChapterId}
        />
      ) : null}

      {isPreferencesOpen ? (
        <ReaderPreferencesOverlay
          fontScale={fontScale}
          onClose={closePanel}
          onDecreaseFont={onDecreaseFont}
          onIncreaseFont={onIncreaseFont}
        />
      ) : null}

      {isAiChatsOpen ? <ReaderAiChatsOverlay onClose={closePanel} /> : null}

      {isHighlightsOpen ? (
        <ReaderHighlightsOverlay
          chapters={payload.chapters}
          onClose={closePanel}
        />
      ) : null}

      {isAiCommentsOpen ? (
        <ReaderAiCommentsOverlay
          libraryItemId={libraryItemId}
          onClose={closePanel}
        />
      ) : null}

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
