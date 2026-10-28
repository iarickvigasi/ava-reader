import { ReaderLoadingCover } from "./reader-loading-cover";
import { ReaderArticle } from "../content/reader-article";
import { ReaderPaginationPreloader } from "../pagination/measurement/reader-pagination-preloader";
import { ReadyReaderProgress } from "./ready-reader-progress";
import { ReaderFrame } from "./reader-frame";
import { ReaderPageViewport } from "./reader-page-viewport";
import type { ReadyReaderProps } from "../shared/types";
import { IosSelectionOverlay } from "../selection/ios/ios-selection-overlay";
import { useReadyReader } from "./use-ready-reader";

export function ReadyReader(props: ReadyReaderProps & { embedded?: boolean }) {
  const {
    activeChapter,
    fontScale,
    payload,
    libraryItemId,
    embedded = false,
  } = props;
  const {
    rootRef,
    availableHeight,
    handleTouchEnd,
    handleTouchStart,
    pageBoxRef,
    isIosSelection,
    onAiCommentClick,
    onHighlightClick,
    pageBoxSize,
    prefixBlocks,
    previousChapter,
    spilloverBlocks,
    nextChapter,
    articleStyle,
    shouldMaskArticle,
    currentPageIndex,
    pageCount,
    isPanelOpen,
    goToNextPage,
    goToPreviousPage,
    iosSelectionRects,
    storeMeasurementEntry,
  } = useReadyReader(props);

  return (
    <>
      <ReaderFrame
        {...props}
        rootRef={rootRef}
        height={availableHeight}
        embedded={embedded}
      >
        <ReaderPageViewport
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
          embedded={embedded}
        >
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
          {!embedded && (
            <ReaderLoadingCover
              loading={shouldMaskArticle}
              book={payload.book}
            />
          )}
        </ReaderPageViewport>

        {!embedded && (
          <ReadyReaderProgress
            completionPercent={payload.progress.completionPercent}
            currentPageIndex={currentPageIndex}
            pageCount={pageCount}
            activeChapter={activeChapter}
            disabled={shouldMaskArticle || isPanelOpen}
            goToNextPage={goToNextPage}
            goToPreviousPage={goToPreviousPage}
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
