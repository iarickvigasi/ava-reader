import type { CSSProperties, ReactNode } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
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
} from "../shared/constants";
import { resolveReaderColumnCount } from "../shared/utils";
import { ReaderArticle } from "./reader-article";

type ChapterRefMap<T extends Element> = {
  get: (chapterId: string) => T | null;
  setRef: (chapterId: string, node: T | null) => void;
};

// Renders every chapter offscreen with the same column layout used by
// the visible reader, then publishes a measurement entry for each
// (pending → ready/failed) so the pagination engine can compute page
// breaks ahead of time.
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
  const articleRefs = useChapterRefMap<HTMLElement>();
  const pageBoxRefs = useChapterRefMap<HTMLDivElement>();
  const articleStyle = useArticleStyle(pageBoxHeight, pageBoxWidth);

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

  const measureChapter = useCallback(
    (chapterId: string) => {
      const article = articleRefs.get(chapterId);
      const pageBox = pageBoxRefs.get(chapterId);
      const layoutKey = createLayoutKey(chapterId);

      if (!article || !pageBox) {
        onMeasurement(createPendingReaderMeasurementEntry({ chapterId, layoutKey }));
        return;
      }

      try {
        onMeasurement(
          createReadyReaderMeasurementEntry({
            article,
            chapterId,
            layoutKey,
            pageBox,
            pageGap: PAGE_GAP,
          }),
        );
      } catch {
        onMeasurement(createFailedReaderMeasurementEntry({ chapterId, layoutKey }));
      }
    },
    [articleRefs, pageBoxRefs, createLayoutKey, onMeasurement],
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
  }, [chapters, createLayoutKey, onMeasurement]);

  const measureAllChapters = useCallback(() => {
    for (const chapter of chapters) {
      measureChapter(chapter.chapterId);
    }
  }, [chapters, measureChapter]);

  useLayoutEffect(() => {
    publishPendingMeasurements();
    measureAllChapters();

    const resizeObserver = new ResizeObserver(measureAllChapters);
    const trackedImages: HTMLImageElement[] = [];

    for (const chapter of chapters) {
      const article = articleRefs.get(chapter.chapterId);
      const pageBox = pageBoxRefs.get(chapter.chapterId);

      if (article) {
        resizeObserver.observe(article);
        for (const image of article.querySelectorAll<HTMLImageElement>("img")) {
          image.addEventListener("load", measureAllChapters);
          trackedImages.push(image);
        }
      }
      if (pageBox) {
        resizeObserver.observe(pageBox);
      }
    }

    return () => {
      resizeObserver.disconnect();
      for (const image of trackedImages) {
        image.removeEventListener("load", measureAllChapters);
      }
    };
  }, [
    chapters,
    articleRefs,
    pageBoxRefs,
    measureAllChapters,
    publishPendingMeasurements,
  ]);

  return (
    <OffscreenPreloaderRoot>
      {chapters.map((chapter) => (
        <PreloadedChapter
          key={chapter.chapterId}
          articleStyle={articleStyle}
          chapter={chapter}
          pageBoxHeight={pageBoxHeight}
          pageBoxWidth={pageBoxWidth}
          setArticleRef={articleRefs.setRef}
          setPageBoxRef={pageBoxRefs.setRef}
        />
      ))}
    </OffscreenPreloaderRoot>
  );
}

function PreloadedChapter({
  articleStyle,
  chapter,
  pageBoxHeight,
  pageBoxWidth,
  setArticleRef,
  setPageBoxRef,
}: {
  articleStyle: CSSProperties;
  chapter: ReaderChapterPayload;
  pageBoxHeight: number;
  pageBoxWidth: number;
  setArticleRef: ChapterRefMap<HTMLElement>["setRef"];
  setPageBoxRef: ChapterRefMap<HTMLDivElement>["setRef"];
}) {
  return (
    <div
      ref={(node) => setPageBoxRef(chapter.chapterId, node)}
      className="overflow-hidden"
      style={{
        height: `${pageBoxHeight}px`,
        width: `${pageBoxWidth}px`,
      }}
    >
      <ReaderArticle
        articleRef={(node) => setArticleRef(chapter.chapterId, node)}
        blocks={chapter.blocks}
        pageHeight={pageBoxHeight}
        style={articleStyle}
      />
    </div>
  );
}

function OffscreenPreloaderRoot({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-[-200vw] top-0 z-[-1] overflow-hidden opacity-0"
      style={{ visibility: READER_VISIBILITY_HIDDEN }}
    >
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function useArticleStyle(
  pageBoxHeight: number,
  pageBoxWidth: number,
): CSSProperties {
  const columnCount = resolveReaderColumnCount(pageBoxWidth);
  return useMemo(
    () =>
      ({
        columnCount,
        columnGap: `${PAGE_GAP}px`,
        height: `${pageBoxHeight}px`,
      }) as CSSProperties,
    [columnCount, pageBoxHeight],
  );
}

// Stable map of chapterId → DOM node, exposed as a get/setRef pair so
// callbacks reading from it don't need to be re-bound on every render.
function useChapterRefMap<T extends Element>(): ChapterRefMap<T> {
  const refs = useRef(new Map<string, T>());

  return useMemo<ChapterRefMap<T>>(
    () => ({
      get: (chapterId) => refs.current.get(chapterId) ?? null,
      setRef: (chapterId, node) => {
        if (node) {
          refs.current.set(chapterId, node);
        } else {
          refs.current.delete(chapterId);
        }
      },
    }),
    [],
  );
}
