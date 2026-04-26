import { useEffect, useMemo, useState } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { ReaderArticle } from "../content/reader-article";
import { ReaderPaginationPreloader } from "../pagination/reader-pagination-preloader";
import {
  ReadyReaderActivityStatus,
  ReadyReaderHeader,
  ReadyReaderProgress,
} from "./ready-reader-sections";
import { ReaderContentsOverlay } from "../overlays/reader-contents-overlay";
import { ReaderPanelButton } from "../overlays/reader-panel-button";
import { ReaderSidebarOverlay } from "../overlays/reader-sidebar-overlay";
import {
  READER_PANEL_CONTENTS,
  READER_VISIBILITY_HIDDEN,
} from "../shared/constants";
import type { ReadyReaderProps } from "../shared/types";
import { useReaderPagination } from "../pagination/use-reader-pagination";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isContentsOpen = activePanel === READER_PANEL_CONTENTS;
  const isPanelOpen = isSidebarOpen || isContentsOpen;

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
            <ReaderPanelButton onOpen={() => setIsSidebarOpen(true)} />
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 sm:mt-8">

            <div
              className="relative min-h-0 flex-1 overflow-hidden px-3 py-5 sm:px-5 sm:py-6 md:px-6"
              style={{
                touchAction: "pan-y",
              }}
              onTouchEnd={handleTouchEnd}
              onTouchStart={handleTouchStart}
            >
              <div ref={pageBoxRef} className="h-full w-full overflow-hidden">
                <ReaderArticle
                  blocks={activeChapter.blocks}
                  pageHeight={pageBoxSize.height}
                  prefixBlocks={prefixBlocks}
                  spilloverBlocks={spilloverBlocks}
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

      {isSidebarOpen ? (
        <ReaderSidebarOverlay
          activeChapter={activeChapter}
          fontScale={fontScale}
          isLoadingChapter={isLoadingChapter}
          onClose={() => setIsSidebarOpen(false)}
          onDecreaseFont={onDecreaseFont}
          onIncreaseFont={onIncreaseFont}
          payload={payload}
        />
      ) : null}

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
