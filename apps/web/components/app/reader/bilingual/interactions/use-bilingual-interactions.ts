import { useCallback, useEffect, useRef } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useKeyboardPageNavigation } from "../../pagination/navigation/use-keyboard-page-navigation";
import { useSwipePageNavigation } from "../../pagination/navigation/use-swipe-page-navigation";
import { useHighlightSelectionBridge } from "../../selection/use-highlight-selection-bridge";
import { useReaderTextSelection } from "../../selection/use-reader-text-selection";
import { useIosSelection } from "../../selection/ios/use-ios-selection";

export function useBilingualInteractions(input: {
  chapterId: string;
  language: string | null;
  pageKey: string;
  disabled: boolean;
  go: (direction: -1 | 1) => void;
}) {
  const { chapterId, language, pageKey, disabled, go } = input;
  const sourceRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<HTMLDivElement>(null);
  const { activePanel } = useReaderUi();
  const isPanelOpen = activePanel !== null;
  const goToNextPage = useCallback(() => go(1), [go]);
  const goToPreviousPage = useCallback(() => go(-1), [go]);
  const controls = {
    goToNextPage,
    goToPreviousPage,
    isPanelOpen: isPanelOpen || disabled,
  };
  useKeyboardPageNavigation(controls);
  const gestures = useSwipePageNavigation({
    ...controls,
    containerRef: gestureRef,
    isLoadingChapter: disabled,
  });
  const { onTextSelected, onHighlightClick, onAiCommentClick } =
    useHighlightSelectionBridge(chapterId);
  useReaderTextSelection({
    containerRef: sourceRef,
    onSelectText: onTextSelected,
    disabled: disabled || isPanelOpen,
  });
  const selection = useIosSelection({
    bookLanguage: language,
    containerRef: sourceRef,
    pageKey: pageKey,
    onSelectText: onTextSelected,
    disabled: disabled || isPanelOpen,
  });
  useEffect(() => {
    window.getSelection()?.removeAllRanges();
  }, [pageKey]);
  return {
    sourceRef,
    gestureRef,
    onHighlightClick,
    onAiCommentClick,
    ...gestures,
    selection,
    goToNextPage,
    goToPreviousPage,
  };
}
