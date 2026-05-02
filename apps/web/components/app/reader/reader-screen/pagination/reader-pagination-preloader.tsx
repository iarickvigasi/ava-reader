import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderMeasurementEntry } from "@/lib/reader-measurement";
import { READER_VISIBILITY_HIDDEN } from "../shared/constants";
import { createReaderColumnLayoutStyle } from "../shared/utils";
import { ReaderArticle } from "../content/reader-article";
import { useChapterMeasurements } from "./use-chapter-measurements";

type ChapterRefMap<T extends Element> = {
  get: (chapterId: string) => T | null;
  setRef: (chapterId: string, node: T | null) => void;
};

// Renders every chapter offscreen with the same column layout used by
// the visible reader. The measurement loop lives in
// useChapterMeasurements.
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

  useChapterMeasurements({
    articleRefs,
    chapters,
    fontScale,
    libraryItemId,
    onMeasurement,
    pageBoxHeight,
    pageBoxRefs,
    pageBoxWidth,
  });

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
  const handlePageBoxRef = useCallback(
    (node: HTMLDivElement | null) => setPageBoxRef(chapter.chapterId, node),
    [chapter.chapterId, setPageBoxRef],
  );
  const handleArticleRef = useCallback(
    (node: HTMLElement | null) => setArticleRef(chapter.chapterId, node),
    [chapter.chapterId, setArticleRef],
  );

  return (
    <div
      ref={handlePageBoxRef}
      className="overflow-hidden"
      style={{
        height: `${pageBoxHeight}px`,
        width: `${pageBoxWidth}px`,
      }}
    >
      <ReaderArticle
        articleRef={handleArticleRef}
        blocks={chapter.blocks}
        chapterId={chapter.chapterId}
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
  return useMemo(
    () =>
      createReaderColumnLayoutStyle({
        height: pageBoxHeight,
        width: pageBoxWidth,
      }),
    [pageBoxHeight, pageBoxWidth],
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
