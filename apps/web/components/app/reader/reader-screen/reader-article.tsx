import type { CSSProperties, Ref } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderInline,
} from "@/lib/api-types";
import { cn } from "@/lib/cn";
import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
  createReadyReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/lib/reader-measurement";
import { createPaginationLayoutKey } from "@/lib/reader-pagination";
import { PAGE_GAP } from "./constants";

export function ReaderArticle({
  articleRef,
  blocks,
  pageHeight,
  style,
}: {
  articleRef?: Ref<HTMLElement>;
  blocks: ReaderBlock[];
  pageHeight: number;
  style?: CSSProperties;
}) {
  return (
    <article
      ref={articleRef}
      className="h-full space-y-8 [column-fill:auto] sm:space-y-10 md:space-y-11"
      style={style}
    >
      {blocks.map((block) => (
        <ReaderBlockView
          key={block.id}
          block={block}
          pageHeight={pageHeight}
        />
      ))}
    </article>
  );
}

export function ReaderPaginationPreloader({
  chapters,
  fontScale,
  libraryItemId,
  onMeasurement,
  pageBoxHeight,
  pageBoxWidth,
}: {
  chapters: ReaderChapterPayload[];
  fontScale: number;
  libraryItemId: string;
  onMeasurement: (entry: ReaderMeasurementEntry) => void;
  pageBoxHeight: number;
  pageBoxWidth: number;
}) {
  const articleRefs = useRef(new Map<string, HTMLElement>());
  const pageBoxRefs = useRef(new Map<string, HTMLDivElement>());

  const setArticleRef = useCallback(
    (chapterId: string, node: HTMLElement | null) => {
      if (node) {
        articleRefs.current.set(chapterId, node);
        return;
      }

      articleRefs.current.delete(chapterId);
    },
    [],
  );

  const setPageBoxRef = useCallback(
    (chapterId: string, node: HTMLDivElement | null) => {
      if (node) {
        pageBoxRefs.current.set(chapterId, node);
        return;
      }

      pageBoxRefs.current.delete(chapterId);
    },
    [],
  );

  const articleStyle = useMemo(
    () =>
      ({
        columnGap: `${PAGE_GAP}px`,
        columnWidth: `${pageBoxWidth}px`,
        height: `${pageBoxHeight}px`,
      }) as CSSProperties,
    [pageBoxHeight, pageBoxWidth],
  );

  const createLayoutKey = useCallback(
    (chapterId: string) =>
      createPaginationLayoutKey({
        chapterId,
        fontScale,
        libraryItemId,
        viewportHeight: pageBoxHeight,
        viewportWidth: pageBoxWidth,
      }),
    [fontScale, libraryItemId, pageBoxHeight, pageBoxWidth],
  );

  const publishPendingMeasurements = useCallback(() => {
    for (const chapter of chapters) {
      onMeasurement(
        createPendingReaderMeasurementEntry({
          chapterId: chapter.chapterId,
          layoutKey: createLayoutKey(chapter.chapterId),
        }),
      );
    }
  }, [
    chapters,
    createLayoutKey,
    onMeasurement,
  ]);

  const measurePreloadedChapters = useCallback(() => {
    for (const chapter of chapters) {
      const article = articleRefs.current.get(chapter.chapterId) ?? null;
      const pageBox = pageBoxRefs.current.get(chapter.chapterId) ?? null;
      const layoutKey = createLayoutKey(chapter.chapterId);

      if (!article || !pageBox) {
        onMeasurement(
          createPendingReaderMeasurementEntry({
            chapterId: chapter.chapterId,
            layoutKey,
          }),
        );
        continue;
      }

      try {
        onMeasurement(
          createReadyReaderMeasurementEntry({
            article,
            chapterId: chapter.chapterId,
            layoutKey,
            pageBox,
            pageGap: PAGE_GAP,
          }),
        );
      } catch {
        onMeasurement(
          createFailedReaderMeasurementEntry({
            chapterId: chapter.chapterId,
            layoutKey,
          }),
        );
      }
    }
  }, [
    chapters,
    createLayoutKey,
    onMeasurement,
  ]);

  useLayoutEffect(() => {
    publishPendingMeasurements();
    measurePreloadedChapters();

    const resizeObserver = new ResizeObserver(() => {
      measurePreloadedChapters();
    });
    const images: HTMLImageElement[] = [];
    const onImageLoad = () => {
      measurePreloadedChapters();
    };

    for (const chapter of chapters) {
      const article = articleRefs.current.get(chapter.chapterId);
      const pageBox = pageBoxRefs.current.get(chapter.chapterId);

      if (article) {
        resizeObserver.observe(article);

        for (const image of article.querySelectorAll<HTMLImageElement>("img")) {
          image.addEventListener("load", onImageLoad);
          images.push(image);
        }
      }

      if (pageBox) {
        resizeObserver.observe(pageBox);
      }
    }

    return () => {
      resizeObserver.disconnect();

      for (const image of images) {
        image.removeEventListener("load", onImageLoad);
      }
    };
  }, [chapters, measurePreloadedChapters, publishPendingMeasurements]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-[-200vw] top-0 z-[-1] overflow-hidden opacity-0"
      style={{
        visibility: "hidden",
      }}
    >
      <div className="space-y-4">
        {chapters.map((chapter) => (
          <div
            key={chapter.chapterId}
            ref={(node) => {
              setPageBoxRef(chapter.chapterId, node);
            }}
            className="overflow-hidden"
            style={{
              height: `${pageBoxHeight}px`,
              width: `${pageBoxWidth}px`,
            }}
          >
            <ReaderArticle
              articleRef={(node) => {
                setArticleRef(chapter.chapterId, node);
              }}
              blocks={chapter.blocks}
              pageHeight={pageBoxHeight}
              style={articleStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReaderBlockView({
  block,
  pageHeight,
}: {
  block: ReaderBlock;
  pageHeight: number;
}) {
  const sharedProps = {
    "data-block-id": block.id,
    "data-reader-block-kind": block.kind,
    "data-reader-block": "true",
    id: block.anchorId ?? undefined,
  } as const;

  if (block.kind === "heading") {
    const headingClassName =
      "break-inside-avoid-column font-(--font-reader) text-[calc(1.7rem*var(--reader-font-scale))] leading-[1.15] font-bold tracking-[-0.03em] text-ink sm:text-[calc(2.15rem*var(--reader-font-scale))]";

    if (block.level === 1) {
      return (
        <h1 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h1>
      );
    }

    if (block.level === 2) {
      return (
        <h2 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h2>
      );
    }

    if (block.level === 3) {
      return (
        <h3 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h3>
      );
    }

    if (block.level === 4) {
      return (
        <h4 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h4>
      );
    }

    if (block.level === 5) {
      return (
        <h5 {...sharedProps} className={headingClassName}>
          <InlineContent inlines={block.inlines} />
        </h5>
      );
    }

    return (
      <h6 {...sharedProps} className={headingClassName}>
        <InlineContent inlines={block.inlines} />
      </h6>
    );
  }

  if (block.kind === "blockquote") {
    return (
      <blockquote
        {...sharedProps}
        className="border-l border-line/60 pl-5 font-(--font-reader) text-[calc(1.18rem*var(--reader-font-scale))] leading-[1.9] italic text-ink/90 sm:text-[calc(1.3rem*var(--reader-font-scale))]"
      >
        <InlineContent inlines={block.inlines} />
      </blockquote>
    );
  }

  if (block.kind === "list") {
    const listClassName = cn(
      "space-y-4 pl-6 font-(--font-reader) text-[calc(1.12rem*var(--reader-font-scale))] leading-loose text-ink sm:text-[calc(1.28rem*var(--reader-font-scale))]",
      block.ordered ? "list-decimal" : "list-disc",
    );

    if (block.ordered) {
      return (
        <ol {...sharedProps} className={listClassName}>
          {block.items.map((item) => (
            <li key={item.id}>
              <InlineContent inlines={item.inlines} />
            </li>
          ))}
        </ol>
      );
    }

    return (
      <ul {...sharedProps} className={listClassName}>
        {block.items.map((item) => (
          <li key={item.id}>
            <InlineContent inlines={item.inlines} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === "image") {
    const imageMaxHeight =
      pageHeight > 0
        ? `${Math.max(160, Math.floor(pageHeight - 64))}px`
        : undefined;

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
      <InlineContent inlines={block.inlines} />
    </p>
  );
}

function InlineContent({ inlines }: { inlines: ReaderInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === "image") {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={inline.alt ?? ""}
              className="mx-1 inline-block max-h-8 max-w-32 align-middle"
              src={inline.src}
            />
          );

          return inline.href ? (
            <a
              key={key}
              href={inline.href}
              className="underline decoration-line/60 underline-offset-4"
            >
              {image}
            </a>
          ) : (
            <span key={key}>{image}</span>
          );
        }

        const content = (
          <span
            className={cn(
              inline.bold && "font-bold",
              inline.italic && "italic",
            )}
          >
            {inline.text}
          </span>
        );

        return inline.href ? (
          <a
            key={key}
            href={inline.href}
            className="underline decoration-line/60 underline-offset-4 hover:text-title"
          >
            {content}
          </a>
        ) : (
          <span key={key}>{content}</span>
        );
      })}
    </>
  );
}
