import type { CSSProperties, Ref } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ReaderBlock, ReaderChapterPayload } from "@/lib/api-types";
import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
  createReadyReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/lib/reader-measurement";
import { createPaginationLayoutKey } from "@/lib/reader-pagination";
import {
  PAGE_GAP,
  READER_VISIBILITY_HIDDEN,
} from "./constants";
import { ReaderBlockView } from "./reader-block-view";

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
        visibility: READER_VISIBILITY_HIDDEN,
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
