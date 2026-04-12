import type { ReaderBlock } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderInlineContent } from "./reader-inline-content";

const READER_BLOCK_DATA_TRUE = "true";
const READER_BLOCK_KIND_HEADING = "heading";
const READER_BLOCK_KIND_BLOCKQUOTE = "blockquote";
const READER_BLOCK_KIND_LIST = "list";
const READER_BLOCK_KIND_IMAGE = "image";

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
  const sharedProps = {
    "data-block-id": block.id,
    "data-reader-block-kind": block.kind,
    "data-reader-block": READER_BLOCK_DATA_TRUE,
    id: block.anchorId ?? undefined,
  };

  if (block.kind === READER_BLOCK_KIND_HEADING) {
    const headingClassName =
      "break-inside-avoid-column font-(--font-reader) text-[calc(1.7rem*var(--reader-font-scale))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale))]";
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
        className="border-l border-line/60 pl-5 font-(--font-reader) text-[calc(1.18rem*var(--reader-font-scale))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale))]"
      >
        <ReaderInlineContent inlines={block.inlines} />
      </blockquote>
    );
  }

  if (block.kind === READER_BLOCK_KIND_LIST) {
    const listClassName = cn(
      "space-y-4 pl-6 font-(--font-reader) text-[calc(1.12rem*var(--reader-font-scale))] leading-loose text-ink sm:text-[calc(1.28rem*var(--reader-font-scale))]",
      block.ordered ? "list-decimal" : "list-disc",
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

  return (
    <p
      {...sharedProps}
      className="font-(--font-reader) text-[calc(1.16rem*var(--reader-font-scale))] leading-loose tracking-[-0.01em] text-ink sm:text-[calc(1.34rem*var(--reader-font-scale))]"
    >
      <ReaderInlineContent inlines={block.inlines} />
    </p>
  );
}
