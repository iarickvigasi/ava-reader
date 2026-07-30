"use client";

import { useCallback } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import { READER_PANEL_AI_TOOLBOX } from "../shared/constants";
import { computeAiCommentLocator } from "./compute-ai-comment-locator";
import { useReaderSelectionContext } from "./reader-selection-context";
import type { ReaderSelection } from "./types";

// Wires the highlight store into the reader's selection flow. Returns the
// callbacks the page-box and ReaderArticle should fire on a fresh selection
// or a click on a painted highlight — both ultimately open the AI Comments
// panel pre-bound to the matching row.
export function useHighlightSelectionBridge(activeChapterId: string): {
  onTextSelected: (selection: ReaderSelection) => void;
  onHighlightClick: (highlightId: string) => void;
  onAiCommentClick: (aiCommentId: string) => void;
} {
  const { openPanel } = useReaderUi();
  const { setSelection } = useReaderSelectionContext();
  const { highlights } = useHighlightsContext();
  const { comments: aiComments } = useAiCommentsContext();

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
      openPanel(READER_PANEL_AI_TOOLBOX);
    },
    [activeChapterId, highlights, openPanel, setSelection],
  );

  // Click on an existing highlight inside the article: open the AI Comments
  // panel pre-bound to that highlight so the user can change/delete the
  // color, or run AI tools against the same selection.
  const onHighlightClick = useCallback(
    (highlightId: string) => {
      const highlight = highlights.find((row) => row.id === highlightId);
      if (!highlight) {
        return;
      }
      setSelection({
        text: highlight.excerpt,
        locator: highlight.locator,
        highlightId: highlight.id,
        highlightColor: highlight.color,
      });
      openPanel(READER_PANEL_AI_TOOLBOX);
    },
    [highlights, openPanel, setSelection],
  );

  // Click on an existing AI-comment underline inside the article: open the
  // AI Toolbox pre-bound to that comment's selection, matching the highlight
  // click flow so the user can run more AI tools against the same fragment.
  const onAiCommentClick = useCallback(
    (aiCommentId: string) => {
      const comment = aiComments.find((row) => row.id === aiCommentId);
      if (!comment?.locator) {
        return;
      }
      const matchedHighlight = highlights.find(
        (highlight) =>
          highlight.locator?.startBlockId === comment.locator?.startBlockId &&
          highlight.locator?.startOffset === comment.locator?.startOffset &&
          highlight.locator?.endBlockId === comment.locator?.endBlockId &&
          highlight.locator?.endOffset === comment.locator?.endOffset,
      );
      setSelection({
        text: comment.sourceText,
        locator: comment.locator,
        highlightId: matchedHighlight?.id ?? null,
        highlightColor: matchedHighlight?.color ?? null,
      });
      openPanel(READER_PANEL_AI_TOOLBOX);
    },
    [aiComments, highlights, openPanel, setSelection],
  );

  return { onTextSelected, onHighlightClick, onAiCommentClick };
}
