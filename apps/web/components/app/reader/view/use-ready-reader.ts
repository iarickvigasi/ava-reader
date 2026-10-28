import { useEffect } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { READER_VISIBILITY_HIDDEN } from "../shared/constants";
import type { ReadyReaderProps } from "../shared/types";
import { useReaderPagination } from "../pagination/use-reader-pagination";
import { useHighlightSelectionBridge } from "../selection/use-highlight-selection-bridge";
import { useReaderTextSelection } from "../selection/use-reader-text-selection";
import { useIosSelection } from "../selection/ios/use-ios-selection";
import { useReaderNeighbors } from "./use-reader-neighbors";

export function useReadyReader(props: ReadyReaderProps) {
  const {
    activeChapter,
    fontScale,
    isBootstrapping,
    isLoadingChapter,
    libraryItemId,
    onSelectChapter,
    onVisibleLocatorChange,
    payload,
    restoreIntent,
    visibleLocator,
  } = props;
  const { activePanel } = useReaderUi();
  const isPanelOpen = activePanel !== null;
  const { previousChapter, nextChapter } = useReaderNeighbors(props);
  const pagination = useReaderPagination({
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
  const { pageBoxRef, shouldMaskArticle, currentPageIndex } = pagination;
  const { onTextSelected, onHighlightClick, onAiCommentClick } =
    useHighlightSelectionBridge(activeChapter.chapterId);
  useReaderTextSelection({
    containerRef: pageBoxRef,
    onSelectText: onTextSelected,
    disabled: shouldMaskArticle,
  });
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
  return {
    ...pagination,
    previousChapter,
    nextChapter,
    isPanelOpen,
    isIosSelection,
    iosSelectionRects,
    onAiCommentClick,
    onHighlightClick,
  };
}
