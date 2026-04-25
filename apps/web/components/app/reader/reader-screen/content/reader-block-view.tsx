import type { CSSProperties } from "react";
import type { ReaderBlock, ReaderBlockAlign } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderInlineContent } from "./reader-inline-content";

const READER_BLOCK_DATA_TRUE = "true";
const READER_BLOCK_KIND_HEADING = "heading";
const READER_BLOCK_KIND_BLOCKQUOTE = "blockquote";
const READER_BLOCK_KIND_LIST = "list";
const READER_BLOCK_KIND_IMAGE = "image";

// Default first-line indent for paragraphs that don't have one set on
// the block. Books that ship no styling at all still look book-like.
// Books that DO style their paragraphs (Dune-style stylesheets with
// .indent / .nonindent) override this via block.textIndent.
const DEFAULT_PARAGRAPH_INDENT_EM = 1.5;

// Resolve the inline style for a block: a per-block font-size multiplier
// (--reader-block-scale, picked up by the calc() classes below), an
// explicit text-indent for paragraphs, and an explicit font-weight when
// the publisher set one. Inline styles win over utility classes, which
// is what we want — a heading's default `font-bold` should give way to
// e.g. `font-weight: 600` when the source asks for semibold.
function resolveBlockStyle(block: ReaderBlock): CSSProperties | undefined {
  const style: Record<string, unknown> = {};

  if ("fontSizeScale" in block && block.fontSizeScale) {
    style["--reader-block-scale"] = block.fontSizeScale;
  }

  const indentEm = resolveParagraphIndentEm(block);
  if (indentEm > 0) {
    style.textIndent = `${indentEm}em`;
  }

  if ("fontWeight" in block && typeof block.fontWeight === "number") {
    style.fontWeight = block.fontWeight;
  }

  return Object.keys(style).length > 0
    ? (style as CSSProperties)
    : undefined;
}

function resolveParagraphIndentEm(block: ReaderBlock): number {
  if (block.kind !== "paragraph") {
    return 0;
  }

  const align = "align" in block ? block.align : undefined;
  if (align === "center" || align === "right") {
    // Indenting a centered or right-aligned paragraph reads as a glitch.
    return 0;
  }

  // Publisher-supplied value wins. textIndent === 0 means "explicitly
  // no indent" (e.g. the .nonindent class on the first paragraph after
  // a heading) and must be respected.
  if (
    "textIndent" in block &&
    typeof block.textIndent === "number"
  ) {
    return block.textIndent;
  }

  return DEFAULT_PARAGRAPH_INDENT_EM;
}

// `text-left` is the default; we omit it so the class string stays
// short and Tailwind's purge isn't tripped up by a class that doesn't
// change anything.
const ALIGNMENT_CLASS_BY_VALUE: Record<ReaderBlockAlign, string> = {
  center: "text-center",
  justify: "text-justify",
  left: "",
  right: "text-right",
};

function resolveAlignmentClass(block: ReaderBlock): string {
  if (!("align" in block) || !block.align) {
    return "";
  }
  return ALIGNMENT_CLASS_BY_VALUE[block.align] ?? "";
}

function renderHeadingBlock({
  className,
  sharedProps,
  block,
}: {
  className: string;
  sharedProps: {
    "data-block-id": string;
    "data-reader-block-kind": string;
    "data-reader-block": string;
    id: string | undefined;
    style?: CSSProperties;
  };
  block: Extract<ReaderBlock, { kind: "heading" }>;
}) {
  const level = block.level;

  if (level === 1) {
    return (
      <h1 {...sharedProps} className={className}>
        <ReaderInlineContent inlines={block.inlines} />
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 {...sharedProps} className={className}>
        <ReaderInlineContent inlines={block.inlines} />
      </h2>
    );
  }

  if (level === 3) {
    return (
      <h3 {...sharedProps} className={className}>
        <ReaderInlineContent inlines={block.inlines} />
      </h3>
    );
  }

  if (level === 4) {
    return (
      <h4 {...sharedProps} className={className}>
        <ReaderInlineContent inlines={block.inlines} />
      </h4>
    );
  }

  if (level === 5) {
    return (
      <h5 {...sharedProps} className={className}>
        <ReaderInlineContent inlines={block.inlines} />
      </h5>
    );
  }

  return (
    <h6 {...sharedProps} className={className}>
      <ReaderInlineContent inlines={block.inlines} />
    </h6>
  );
}

export function ReaderBlockView({
  block,
  pageHeight,
}: {
  block: ReaderBlock;
  pageHeight: number;
}) {
  const blockStyle = resolveBlockStyle(block);
  const sharedProps = {
    "data-block-id": block.id,
    "data-reader-block-kind": block.kind,
    "data-reader-block": READER_BLOCK_DATA_TRUE,
    id: block.anchorId ?? undefined,
    ...(blockStyle ? { style: blockStyle } : {}),
  };

  const alignmentClass = resolveAlignmentClass(block);

  if (block.kind === READER_BLOCK_KIND_HEADING) {
    const headingClassName = cn(
      "break-inside-avoid-column font-(--font-reader) text-[calc(1.7rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale)*var(--reader-block-scale,1))]",
      alignmentClass,
    );
    return renderHeadingBlock({
      block,
      className: headingClassName,
      sharedProps,
    });
  }

  if (block.kind === READER_BLOCK_KIND_BLOCKQUOTE) {
    return (
      <blockquote
        {...sharedProps}
        className={cn(
          "border-l border-line/60 pl-5 font-(--font-reader) text-[calc(1.18rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale)*var(--reader-block-scale,1))]",
          alignmentClass,
        )}
      >
        <ReaderInlineContent inlines={block.inlines} />
      </blockquote>
    );
  }

  if (block.kind === READER_BLOCK_KIND_LIST) {
    const listClassName = cn(
      "space-y-1 pl-6 font-(--font-reader) text-[calc(1.12rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-relaxed text-ink sm:text-[calc(1.28rem*var(--reader-font-scale)*var(--reader-block-scale,1))]",
      block.ordered ? "list-decimal" : "list-disc",
      alignmentClass,
    );

    if (block.ordered) {
      return (
        <ol {...sharedProps} className={listClassName}>
          {block.items.map((item) => (
            <li key={item.id}>
              <ReaderInlineContent inlines={item.inlines} />
            </li>
          ))}
        </ol>
      );
    }

    return (
      <ul {...sharedProps} className={listClassName}>
        {block.items.map((item) => (
          <li key={item.id}>
            <ReaderInlineContent inlines={item.inlines} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === READER_BLOCK_KIND_IMAGE) {
    const imageMaxHeight =
      pageHeight > 0 ? `${Math.max(160, Math.floor(pageHeight - 64))}px` : undefined;

    return (
      <figure {...sharedProps} className="break-inside-avoid-column space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={block.alt ?? ""}
          className="w-full rounded-[22px] border border-line/30 object-contain"
          src={block.src}
          style={{
            maxHeight: imageMaxHeight,
          }}
        />
        {block.alt ? (
          <figcaption className="font-(--font-ui) text-sm text-ink/55">
            {block.alt}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  // text-indent comes through sharedProps.style (see resolveBlockStyle).
  return (
    <p
      {...sharedProps}
      className={cn(
        "font-(--font-reader) text-[calc(1.16rem*var(--reader-font-scale)*var(--reader-block-scale,1))] leading-loose tracking-[-0.01em] text-ink sm:text-[calc(1.34rem*var(--reader-font-scale)*var(--reader-block-scale,1))]",
        alignmentClass,
      )}
    >
      <ReaderInlineContent inlines={block.inlines} />
    </p>
  );
}
