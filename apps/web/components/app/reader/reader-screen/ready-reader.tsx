import { useEffect, useState } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { ReaderArticle, ReaderPaginationPreloader } from "./reader-article";
import {
  ReaderContentsOverlay,
  ReaderPanelButton,
  ReaderSidebarOverlay,
} from "./reader-overlays";
import type { ReadyReaderProps } from "./types";
import { formatReaderHeaderLine } from "./utils";
import { useReadyReaderPagination } from "./use-ready-reader-pagination";

function ReaderHeader({
  activeChapter,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
}) {
  return (
    <header className="min-w-0 flex-1 pt-1">
      <h1 className="max-w-full truncate font-(--font-ui) text-[1.05rem] leading-none tracking-[0.01em] text-title sm:text-[1.2rem]">
        {formatReaderHeaderLine(payload, activeChapter)}
      </h1>
    </header>
  );
}

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
  const isContentsOpen = activePanel === "contents";
  const isPanelOpen = isSidebarOpen || isContentsOpen;

  const {
    articleStyle,
    availableHeight,
    currentPageIndex,
    handleTouchEnd,
    handleTouchStart,
    pageBoxRef,
    pageBoxSize,
    pageCount,
    rootRef,
    shouldMaskArticle,
    storeMeasurementEntry,
  } = useReadyReaderPagination({
    activeChapter,
    fontScale,
    isBootstrapping,
    isLoadingChapter,
    isPanelOpen,
    libraryItemId,
    onSelectChapter,
    onVisibleLocatorChange,
    restoreIntent,
    visibleLocator,
  });

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
            <ReaderHeader activeChapter={activeChapter} payload={payload} />
            <ReaderPanelButton onOpen={() => setIsSidebarOpen(true)} />
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 sm:mt-8">
            {isBootstrapping ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
                Restoring your last page...
              </p>
            ) : isLoadingChapter ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/45">
                Loading chapter...
              </p>
            ) : isRefreshingWindow ? (
              <p className="font-(--font-ui) text-xs uppercase tracking-[0.16em] text-ink/35">
                Preloading nearby chapter...
              </p>
            ) : null}

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
                  style={articleStyle}
                />
              </div>
              {shouldMaskArticle ? (
                <div className="pointer-events-none absolute inset-0 bg-paper/55 backdrop-blur-[2px]" />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-3 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink/45">
                <span>{payload.progress.completionPercent}% complete</span>
                <span>
                  Page {Math.min(currentPageIndex + 1, pageCount)} of {pageCount} in chapter
                </span>
              </div>
            </div>
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
