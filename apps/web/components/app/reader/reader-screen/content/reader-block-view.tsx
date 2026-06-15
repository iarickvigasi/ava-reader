import type { CSSProperties } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { resolveAlignmentClass, resolveBlockStyle } from "./reader-block-style";
import { ReaderInlineContent } from "./reader-inline-content";

type SharedBlockProps = {
  "data-block-id": string;
  "data-chapter-id": string;
  "data-reader-block-kind": string;
  "data-reader-block": "true";
  id: string | undefined;
  style?: CSSProperties;
};

// Paragraph and blockquote share a single union variant, so a
// kind-by-kind Extract collapses to never. These aliases pull the
// variants out by hand.
type TextReaderBlock = Extract<ReaderBlock, { kind: "paragraph" | "blockquote" }>;
type HeadingReaderBlock = Extract<ReaderBlock, { kind: "heading" }>;
type ListReaderBlock = Extract<ReaderBlock, { kind: "list" }>;
type ImageReaderBlock = Extract<ReaderBlock, { kind: "image" }>;

type WithSharedProps<TBlock> = {
  block: TBlock;
  sharedProps: SharedBlockProps;
  alignmentClass: string;
};

const HEADING_CLASS =
  "break-inside-avoid-column font-reader text-[calc(1.7rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";

const BLOCKQUOTE_CLASS =
  "border-l border-line/60 pl-5 font-reader text-[calc(1.18rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";

const LIST_CLASS =
  "space-y-1 pl-6 font-reader text-[calc(1.12rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-relaxed text-ink sm:text-[calc(1.28rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";

const PARAGRAPH_CLASS =
  "font-reader text-[calc(1.16rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-loose tracking-[-0.01em] text-ink sm:text-[calc(1.34rem*var(--reader-font-scale)*var(--reader-block-scale,1))]";

const FIGURE_MIN_HEIGHT_PX = 160;
const FIGURE_RESERVED_HEIGHT_PX = 64;

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
const HEADING_LEVEL_MIN = 1;
const HEADING_LEVEL_MAX = 6;

export function ReaderBlockView({
  block,
  chapterId,
  pageHeight,
  forceColumnBreakBefore,
}: {
  block: ReaderBlock;
  chapterId: string;
  pageHeight: number;
  forceColumnBreakBefore?: boolean;
}) {
  const sharedProps = createSharedBlockProps(
    block,
    chapterId,
    forceColumnBreakBefore,
  );
  const alignmentClass = resolveAlignmentClass(block);

  switch (block.kind) {
    case "heading":
      return (
        <HeadingBlock
          block={block}
          sharedProps={sharedProps}
          alignmentClass={alignmentClass}
        />
      );
    case "blockquote":
      return (
        <BlockquoteBlock
          block={block}
          sharedProps={sharedProps}
          alignmentClass={alignmentClass}
        />
      );
    case "list":
      return (
        <ListBlock
          block={block}
          sharedProps={sharedProps}
          alignmentClass={alignmentClass}
        />
      );
    case "image":
      return (
        <ImageBlock
          block={block}
          sharedProps={sharedProps}
          pageHeight={pageHeight}
        />
      );
    default:
      return (
        <ParagraphBlock
          block={block}
          sharedProps={sharedProps}
          alignmentClass={alignmentClass}
        />
      );
  }
}

function createSharedBlockProps(
  block: ReaderBlock,
  chapterId: string,
  forceColumnBreakBefore: boolean | undefined,
): SharedBlockProps {
  const blockStyle = resolveBlockStyle(block);
  // When the block is the first of a "spillover" chapter rendered
  // after a single-page chapter, force it into a fresh column so the
  // prior chapter stays alone in its column.
  const style = forceColumnBreakBefore
    ? ({ ...(blockStyle ?? {}), breakBefore: "column" } as CSSProperties)
    : blockStyle;

  return {
    "data-block-id": block.id,
    "data-chapter-id": chapterId,
    "data-reader-block-kind": block.kind,
    "data-reader-block": "true",
    id: block.anchorId ?? undefined,
    ...(style ? { style } : {}),
  };
}

function HeadingBlock({
  block,
  sharedProps,
  alignmentClass,
}: WithSharedProps<HeadingReaderBlock>) {
  const level = clampHeadingLevel(block.level);
  const Tag = `h${level}` as HeadingTag;

  return (
    <Tag {...sharedProps} className={cn(HEADING_CLASS, alignmentClass)}>
      <ReaderInlineContent inlines={block.inlines} />
    </Tag>
  );
}

function clampHeadingLevel(level: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (level <= HEADING_LEVEL_MIN) return 1;
  if (level >= HEADING_LEVEL_MAX) return 6;
  return level as 2 | 3 | 4 | 5;
}

function BlockquoteBlock({
  block,
  sharedProps,
  alignmentClass,
}: WithSharedProps<TextReaderBlock>) {
  return (
    <blockquote
      {...sharedProps}
      className={cn(BLOCKQUOTE_CLASS, alignmentClass)}
    >
      <ReaderInlineContent inlines={block.inlines} />
    </blockquote>
  );
}

function ListBlock({
  block,
  sharedProps,
  alignmentClass,
}: WithSharedProps<ListReaderBlock>) {
  const Tag = block.ordered ? "ol" : "ul";
  const className = cn(
    LIST_CLASS,
    block.ordered ? "list-decimal" : "list-disc",
    alignmentClass,
  );

  return (
    <Tag {...sharedProps} className={className}>
      {block.items.map((item) => (
        <li key={item.id}>
          <ReaderInlineContent inlines={item.inlines} />
        </li>
      ))}
    </Tag>
  );
}

function ImageBlock({
  block,
  sharedProps,
  pageHeight,
}: {
  block: ImageReaderBlock;
  sharedProps: SharedBlockProps;
  pageHeight: number;
}) {
  const maxHeight = resolveImageMaxHeight(pageHeight);

  return (
    <figure
      {...sharedProps}
      className="break-inside-avoid-column space-y-3"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={block.alt ?? ""}
        className="w-full rounded-card object-contain"
        src={block.src}
        style={{ maxHeight }}
      />
    </figure>
  );
}

function resolveImageMaxHeight(pageHeight: number): string | undefined {
  if (pageHeight <= 0) return undefined;
  const available = pageHeight - FIGURE_RESERVED_HEIGHT_PX;
  return `${Math.max(FIGURE_MIN_HEIGHT_PX, Math.floor(available))}px`;
}

function ParagraphBlock({
  block,
  sharedProps,
  alignmentClass,
}: WithSharedProps<TextReaderBlock>) {
  // text-indent comes through sharedProps.style (see resolveBlockStyle).
  return (
    <p {...sharedProps} className={cn(PARAGRAPH_CLASS, alignmentClass)}>
      <ReaderInlineContent inlines={block.inlines} />
    </p>
  );
}
