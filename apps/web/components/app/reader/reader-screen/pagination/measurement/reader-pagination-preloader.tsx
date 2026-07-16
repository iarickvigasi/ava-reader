import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import { READER_VISIBILITY_HIDDEN } from "../../shared/constants";
import { createReaderColumnLayoutStyle } from "../../shared/utils";
import { useChapterMeasurements } from "./use-chapter-measurements";
import { useChapterRefMap } from "./use-chapter-ref-map";
import { PreloadedChapter } from "./preloaded-chapter";

// Renders every chapter offscreen with the same column layout used by the
// visible reader. The measurement loop lives in useChapterMeasurements.
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
  const articleStyle = usePreloaderColumnStyle(pageBoxHeight, pageBoxWidth);

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

// The offscreen column layout — same column math as the visible reader, but
// without the page-translation transform (every page is rendered for measuring).
function usePreloaderColumnStyle(
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
