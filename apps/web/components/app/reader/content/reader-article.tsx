import type { CSSProperties, RefCallback } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { useAiCommentsContext } from "../overlays/ai-comments/ai-comments-context";
import { useHighlightsContext } from "../overlays/highlights/highlights-context";
import {
  AI_COMMENT_MARK_CLASS,
  applyAiCommentMarks,
  unwrapAllMarks,
} from "./apply-ai-comment-marks";
import {
  HIGHLIGHT_MARK_CLASS,
  applyHighlightMarks,
  unwrapAllHighlightMarks,
} from "./apply-highlight-marks";
import { ReaderBlockView } from "./reader-block-view";

export function ReaderArticle({
  articleRef,
  applyAiComments = false,
  blocks,
  chapterId,
  onAiCommentClick,
  onHighlightClick,
  pageHeight,
  prefixBlocks,
  prefixChapterId,
  spilloverBlocks,
  spilloverChapterId,
  style,
}: {
  // Callback ref for parents that need to track the article element (e.g.,
  // the pagination preloader's per-chapter measurement map). Object refs
  // are not supported because they would require mutating the prop.
  articleRef?: RefCallback<HTMLElement>;
  // Opt in to wrapping every comment/highlight whose locator resolves inside
  // the article in a styled <mark> after each render. The preloader renders
  // off-screen "measurement" articles where marks would corrupt the
  // measured layout, so it leaves this off.
  applyAiComments?: boolean;
  blocks: ReaderBlock[];
  chapterId: string;
  // Called when the user clicks an AI-comment underline inside the article.
  // The screen routes this to the AI Toolbox pre-bound to the fragment.
  // Omitted by the pagination preloader.
  onAiCommentClick?: (aiCommentId: string) => void;
  // Called when the user clicks a painted highlight inside the article.
  // The screen routes this to the AI Comments panel pre-bound to the row.
  // Omitted by the pagination preloader (its measurement articles aren't
  // interactive).
  onHighlightClick?: (highlightId: string) => void;
  pageHeight: number;
  // Previous chapter rendered in column 1 of the spread; the active
  // chapter's first block is then forced into a new column so it
  // starts in column 2. Pair with a one-page translation offset so the
  // active chapter does not re-show its own first column.
  prefixBlocks?: ReaderBlock[];
  prefixChapterId?: string | null;
  // Next chapter rendered after the active chapter so its first column
  // fills the empty column 2 when the active chapter is a single-page
  // chapter.
  spilloverBlocks?: ReaderBlock[];
  spilloverChapterId?: string | null;
  style?: CSSProperties;
}) {
  const hasPrefix = (prefixBlocks?.length ?? 0) > 0;

  const internalArticleRef = useRef<HTMLElement | null>(null);
  const { comments: aiComments } = useAiCommentsContext();
  const { highlights } = useHighlightsContext();

  // Combine the internal ref (used by the highlighter) with any forwarded
  // articleRef callback the parent needs (used by the pagination preloader).
  const setArticleRef = useCallback(
    (node: HTMLElement | null) => {
      internalArticleRef.current = node;
      articleRef?.(node);
    },
    [articleRef],
  );

  // React clears our injected <mark> wrappers on every render (it diffs the
  // virtual text node against the actual DOM and replaces it). useLayoutEffect
  // re-applies them synchronously so the highlights never visibly flicker.
  // Highlights paint first (background), then AI-comment underlines on top —
  // both can coexist on the same span.
  useLayoutEffect(() => {
    if (!applyAiComments) {
      return;
    }
    const article = internalArticleRef.current;
    if (!article) {
      return;
    }
    if (highlights.length > 0) {
      applyHighlightMarks(article, highlights);
    }
    if (aiComments.length > 0) {
      applyAiCommentMarks(article, aiComments);
    }
    return () => {
      unwrapAllMarks(article);
      unwrapAllHighlightMarks(article);
    };
  }, [
    applyAiComments,
    aiComments,
    highlights,
    blocks,
    prefixBlocks,
    spilloverBlocks,
  ]);

  // Click-to-edit on a painted highlight or AI-comment underline. One
  // delegated listener on the article catches every mark click; `closest`
  // returns the innermost matching ancestor, so overlapping marks resolve
  // to whichever was applied last (AI-comment marks are nested inside
  // highlight marks because they're applied second).
  const handleArticleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!onHighlightClick && !onAiCommentClick) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const mark = target.closest<HTMLElement>(
        `mark.${AI_COMMENT_MARK_CLASS}, mark.${HIGHLIGHT_MARK_CLASS}`,
      );
      if (!mark) {
        return;
      }
      if (mark.classList.contains(AI_COMMENT_MARK_CLASS)) {
        const aiCommentId = mark.dataset.aiCommentId;
        if (!aiCommentId || !onAiCommentClick) {
          return;
        }
        event.stopPropagation();
        onAiCommentClick(aiCommentId);
        return;
      }
      const highlightId = mark.dataset.highlightId;
      if (!highlightId || !onHighlightClick) {
        return;
      }
      event.stopPropagation();
      onHighlightClick(highlightId);
    },
    [onAiCommentClick, onHighlightClick],
  );

  return (
    <article
      ref={setArticleRef}
      onClick={handleArticleClick}
      // break-words is inherited, so it reaches every block kind, every
      // injected <mark>, and anything added later: a line can never outgrow
      // its column, and a column is a page. Without it an unbreakable token
      // paints across the gap onto the next page (see 1.1-content-rendering).
      className="h-full space-y-5 break-words [column-fill:auto] sm:space-y-6 md:space-y-7"
      style={style}
    >
      {prefixBlocks?.map((block) => (
        <ReaderBlockView
          key={`prefix:${block.id}`}
          block={block}
          chapterId={prefixChapterId ?? chapterId}
          pageHeight={pageHeight}
        />
      ))}
      {blocks.map((block, index) => (
        <ReaderBlockView
          key={block.id}
          block={block}
          chapterId={chapterId}
          pageHeight={pageHeight}
          // Force a column break so the active chapter starts in
          // column 2 after the prefix sits alone in column 1.
          forceColumnBreakBefore={hasPrefix && index === 0}
        />
      ))}
      {spilloverBlocks?.map((block, index) => (
        <ReaderBlockView
          key={`spillover:${block.id}`}
          block={block}
          chapterId={spilloverChapterId ?? chapterId}
          pageHeight={pageHeight}
          forceColumnBreakBefore={index === 0}
        />
      ))}
    </article>
  );
}
