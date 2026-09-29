import type { CSSProperties, ElementType } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { ReaderInlineContent } from "./reader-inline-content";
import { blockProps } from "./block-props";
import {
  HEADING_CLASS,
  BLOCKQUOTE_CLASS,
  PARAGRAPH_CLASS,
} from "./reader-block-classes";
import { resolveAlignmentClass } from "./reader-block-style";
import { ReaderNoteReturns } from "./reader-note-returns";

type TextBlock = Extract<ReaderBlock, { inlines: unknown }>;
export function ReaderTextBlockView({
  block,
  chapterId,
  style,
}: {
  block: TextBlock;
  chapterId: string;
  style?: CSSProperties;
}) {
  const literal = block.kind === "code" || block.kind === "verse";
  const Tag: ElementType =
    block.kind === "heading"
      ? (`h${Math.min(6, Math.max(1, block.level))}` as ElementType)
      : block.kind === "blockquote"
        ? "blockquote"
        : block.kind === "aside"
          ? "aside"
          : literal
            ? "pre"
            : "p";
  const typography =
    block.kind === "heading"
      ? HEADING_CLASS
      : block.kind === "blockquote"
        ? BLOCKQUOTE_CLASS
        : PARAGRAPH_CLASS;
  const content = (
    <Tag
      {...blockProps(block, chapterId, style)}
      data-reader-block-kind={block.kind}
      className={`${typography} ${resolveAlignmentClass(block)} ${literal ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : ""} ${block.kind === "caption" || block.kind === "credit" ? "text-[0.9em]" : ""}`.trim()}
    >
      {block.kind === "code" ? (
        <code>
          <ReaderInlineContent inlines={block.inlines} />
        </code>
      ) : (
        <ReaderInlineContent inlines={block.inlines} />
      )}
    </Tag>
  );
  return block.kind === "note" ? (
    <aside role="doc-footnote" className="break-inside-avoid-column">
      {content}
      <ReaderNoteReturns blockId={block.id} returns={block.returns ?? []} />
    </aside>
  ) : (
    content
  );
}
