import type { CSSProperties, RefCallback } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import type { AiCommentRecord } from "../overlays/ai-comments/use-ai-comments";
import {
  applyAiCommentMarks,
  unwrapAllMarks,
} from "./apply-ai-comment-marks";
import { ReaderBlockView } from "./reader-block-view";

export function ReaderArticle({
  articleRef,
  aiComments,
  blocks,
  chapterId,
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
  // When provided, every comment whose locator resolves inside the article is
  // wrapped in a styled <mark> after each render. The preloader renders
  // off-screen "measurement" articles without comments, so highlighting is
  // skipped there.
  aiComments?: readonly AiCommentRecord[];
  blocks: ReaderBlock[];
  chapterId: string;
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
  useLayoutEffect(() => {
    const article = internalArticleRef.current;
    if (!article || !aiComments || aiComments.length === 0) {
      return;
    }
    applyAiCommentMarks(article, aiComments);
    return () => {
      unwrapAllMarks(article);
    };
  }, [aiComments, blocks, prefixBlocks, spilloverBlocks]);

  return (
    <article
      ref={setArticleRef}
      className="h-full space-y-5 [column-fill:auto] sm:space-y-6 md:space-y-7"
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
