"use client";

import { useCallback } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import { READER_PANEL_AI_TOOLBOX } from "../shared/constants";
import { computeAiCommentLocator } from "./compute-ai-comment-locator";
import { useReaderSelectionContext } from "./reader-selection-context";
import type { ReaderSelection } from "./types";

export function useHighlightSelectionBridge(activeChapterId: string): {
  onTextSelected: (selection: ReaderSelection) => void;
  onHighlightClick: (highlightId: string) => void;
  onAiCommentClick: (aiCommentId: string) => void;
} {
  const { openPanel } = useReaderUi();
  const { setSelection } = useReaderSelectionContext();
  const { highlights } = useHighlightsContext();
  const { comments: aiComments } = useAiCommentsContext();

  const onTextSelected = useCallback(
    ({
      text,
      range,
      pointer,
      locator: providedLocator,
      context,
      contextOffset,
    }: ReaderSelection) => {
      const locator =
        providedLocator === undefined
          ? computeAiCommentLocator(range, activeChapterId)
          : providedLocator;
      const matched = locator
        ? (highlights.find(
            (highlight) =>
              JSON.stringify(highlight.locator?.translation) ===
                JSON.stringify(locator.translation) &&
              highlight.locator?.startBlockId === locator.startBlockId &&
              highlight.locator?.startOffset === locator.startOffset &&
              highlight.locator?.endBlockId === locator.endBlockId &&
              highlight.locator?.endOffset === locator.endOffset,
          ) ?? null)
        : null;
      setSelection({
        text,
        locator,
        pointer,
        context,
        contextOffset,
        highlightId: matched?.id ?? null,
        highlightColor: matched?.color ?? null,
      });
      openPanel(READER_PANEL_AI_TOOLBOX);
    },
    [activeChapterId, highlights, openPanel, setSelection],
  );
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
