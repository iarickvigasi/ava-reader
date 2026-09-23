import { useCallback, useEffect, useRef } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useKeyboardPageNavigation } from "../../pagination/navigation/use-keyboard-page-navigation";
import { useSwipePageNavigation } from "../../pagination/navigation/use-swipe-page-navigation";
import { useHighlightSelectionBridge } from "../../selection/use-highlight-selection-bridge";
import { useReaderTextSelection } from "../../selection/use-reader-text-selection";
import { useIosSelection } from "../../selection/ios/use-ios-selection";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderSelection } from "../../selection/types";
import { bilingualLanguageTag } from "@/features/reader/bilingual/content/language-tag";
import { translationSelection } from "./translation-selection";
import { useBilingualAlignment } from "./use-bilingual-alignment";

export function useBilingualInteractions(input: {
  chapter: BilingualChapter | null;
  chapterId: string;
  language: string | null;
  pageKey: string;
  disabled: boolean;
  go: (direction: -1 | 1) => void;
}) {
  const { chapter, chapterId, language, pageKey, disabled, go } = input;
  const sourceRef = useRef<HTMLElement>(null);
  const translationRef = useRef<HTMLElement>(null);
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
  const onTranslationSelected = useCallback(
    (selected: ReaderSelection) => {
      if (chapter) onTextSelected(translationSelection(selected, chapter));
    },
    [chapter, onTextSelected],
  );
  useReaderTextSelection({
    containerRef: translationRef,
    onSelectText: onTranslationSelected,
    disabled: disabled || isPanelOpen,
  });
  const translatedSelection = useIosSelection({
    languageKey: chapter?.targetLang ?? "",
    bookLanguage: bilingualLanguageTag(chapter?.targetLang ?? "") ?? null,
    containerRef: translationRef,
    pageKey: `${pageKey}:translation`,
    onSelectText: onTranslationSelected,
    disabled: disabled || isPanelOpen,
  });
  const alignmentRects = useBilingualAlignment({
    rootRef: gestureRef,
    chapter,
    pageKey,
    disabled: disabled || isPanelOpen,
  });
  useEffect(() => {
    window.getSelection()?.removeAllRanges();
  }, [pageKey]);
  return {
    sourceRef,
    translationRef,
    alignmentRects,
    translatedSelection,
    gestureRef,
    onHighlightClick,
    onAiCommentClick,
    ...gestures,
    selection,
    goToNextPage,
    goToPreviousPage,
  };
}
