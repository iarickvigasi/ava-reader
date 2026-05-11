"use client";

import { useCallback, useEffect } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { READER_HIGHLIGHT_CLICK_EVENT } from "../content/reader-article";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import { READER_PANEL_AI_COMMENTS } from "../shared/constants";
import { computeAiCommentLocator } from "./compute-ai-comment-locator";
import { useReaderSelectionContext } from "./reader-selection-context";
import type { ReaderSelection } from "./use-reader-text-selection";

// Wires the highlight store into the reader's selection flow. Returns the
// `onTextSelected` callback the page-box should fire on every fresh
// selection; also subscribes to the highlight-click custom event so clicking
// a painted highlight inside the article opens the AI Comments panel pre-bound to that row.
export function useHighlightSelectionBridge(activeChapterId: string): {
  onTextSelected: (selection: ReaderSelection) => void;
} {
  const { openPanel } = useReaderUi();
  const { setSelection } = useReaderSelectionContext();
  const { highlights } = useHighlightsContext();

  // Fresh selection: open the AI Comments panel. If the range exactly
  // matches an existing highlight, pre-bind to its id/color so the swatch
  // shows the current color and clicks toggle/replace instead of stacking
  // duplicates.
  const onTextSelected = useCallback(
    ({ text, range }: ReaderSelection) => {
      const locator = computeAiCommentLocator(range, activeChapterId);
      const matched = locator
        ? highlights.find(
            (highlight) =>
              highlight.locator?.startBlockId === locator.startBlockId &&
              highlight.locator?.startOffset === locator.startOffset &&
              highlight.locator?.endBlockId === locator.endBlockId &&
              highlight.locator?.endOffset === locator.endOffset,
          ) ?? null
        : null;
      setSelection({
        text,
        locator,
        highlightId: matched?.id ?? null,
        highlightColor: matched?.color ?? null,
      });
      openPanel(READER_PANEL_AI_COMMENTS);
    },
    [activeChapterId, highlights, openPanel, setSelection],
  );

  // Click on an existing highlight inside the article: open the AI Comments
  // panel pre-bound to that highlight so the user can change/delete the
  // color, or run AI tools against the same selection. The custom event is
  // dispatched by ReaderArticle's delegated click handler.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ highlightId: string }>).detail;
      const highlight = highlights.find((row) => row.id === detail.highlightId);
      if (!highlight) {
        return;
      }
      setSelection({
        text: highlight.excerpt,
        locator: highlight.locator,
        highlightId: highlight.id,
        highlightColor: highlight.color,
      });
      openPanel(READER_PANEL_AI_COMMENTS);
    };
    window.addEventListener(READER_HIGHLIGHT_CLICK_EVENT, handler);
    return () => {
      window.removeEventListener(READER_HIGHLIGHT_CLICK_EVENT, handler);
    };
  }, [highlights, openPanel, setSelection]);

  return { onTextSelected };
}
