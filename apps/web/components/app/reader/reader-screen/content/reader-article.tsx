import type { CSSProperties, Ref } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { ReaderBlockView } from "./reader-block-view";

export function ReaderArticle({
  articleRef,
  blocks,
  pageHeight,
  prefixBlocks,
  spilloverBlocks,
  style,
}: {
  articleRef?: Ref<HTMLElement>;
  blocks: ReaderBlock[];
  pageHeight: number;
  // Previous chapter rendered in column 1 of the spread; the active
  // chapter's first block is then forced into a new column so it
  // starts in column 2. Pair with a one-page translation offset so the
  // active chapter does not re-show its own first column.
  prefixBlocks?: ReaderBlock[];
  // Next chapter rendered after the active chapter so its first column
  // fills the empty column 2 when the active chapter is a single-page
  // chapter.
  spilloverBlocks?: ReaderBlock[];
  style?: CSSProperties;
}) {
  const hasPrefix = (prefixBlocks?.length ?? 0) > 0;

  return (
    <article
      ref={articleRef}
      className="h-full space-y-5 [column-fill:auto] sm:space-y-6 md:space-y-7"
      style={style}
    >
      {prefixBlocks?.map((block) => (
        <ReaderBlockView
          key={`prefix:${block.id}`}
          block={block}
          pageHeight={pageHeight}
        />
      ))}
      {blocks.map((block, index) => (
        <ReaderBlockView
          key={block.id}
          block={block}
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
          pageHeight={pageHeight}
          forceColumnBreakBefore={index === 0}
        />
      ))}
    </article>
  );
}
