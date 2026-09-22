import { useLayoutEffect, type RefObject } from "react";
import type { ReaderBlock } from "@/lib/api-types/reader";
import { useAiCommentsContext } from "../../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../../overlays/highlights/highlights-context";
import {
  AI_COMMENT_MARK_CLASS,
  unwrapAllMarks,
} from "@/components/app/reader/content/apply-ai-comment-marks";
import {
  HIGHLIGHT_MARK_CLASS,
  unwrapAllHighlightMarks,
} from "@/components/app/reader/content/apply-highlight-marks";
import { applyBilingualMarks } from "./apply-bilingual-marks";

export function useBilingualMarks({
  articleRef,
  chapterId,
  blocks,
  pageKey,
  onAiCommentClick,
  onHighlightClick,
}: {
  articleRef: RefObject<HTMLElement | null>;
  chapterId: string;
  blocks: ReaderBlock[];
  pageKey: unknown;
  onAiCommentClick?: (id: string) => void;
  onHighlightClick?: (id: string) => void;
}) {
  const { comments } = useAiCommentsContext();
  const { highlights } = useHighlightsContext();
  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    applyBilingualMarks({
      article,
      chapterId,
      blockIds: blocks.map((block) => block.id),
      highlights,
      comments,
    });
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const mark = event.target.closest<HTMLElement>(
        `mark.${AI_COMMENT_MARK_CLASS}, mark.${HIGHLIGHT_MARK_CLASS}`,
      );
      if (!mark) return;
      const id = mark.dataset.aiCommentId ?? mark.dataset.highlightId;
      const callback = mark.dataset.aiCommentId
        ? onAiCommentClick
        : onHighlightClick;
      if (id && callback) {
        event.stopPropagation();
        callback(id);
      }
    }
    article.addEventListener("click", onClick);
    return () => {
      article.removeEventListener("click", onClick);
      unwrapAllMarks(article);
      unwrapAllHighlightMarks(article);
    };
  }, [
    articleRef,
    chapterId,
    blocks,
    pageKey,
    highlights,
    comments,
    onAiCommentClick,
    onHighlightClick,
  ]);
}
