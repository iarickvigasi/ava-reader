import { useCallback, useLayoutEffect } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import {
  createPendingReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/features/reader/measurement";
import { createPaginationLayoutKey } from "@/features/reader/pagination";
import { PAGE_GAP } from "../shared/constants";
import { resolveReaderColumnCount } from "../shared/utils";
import type { ChapterRefReader } from "./use-chapter-ref-map";
import { measureChapterEntry } from "./measure-chapter-entry";
import { observeMeasurementTriggers } from "./observe-measurement-triggers";

// Drives the offscreen preloader's measurement loop:
//   1. emit a "pending" entry for every chapter,
//   2. measure any chapter whose article + pageBox refs are mounted,
//   3. re-measure when layout shifts (ResizeObserver) or images load.
export function useChapterMeasurements({
  articleRefs,
  chapters,
  fontScale,
  libraryItemId,
  onMeasurement,
  pageBoxHeight,
  pageBoxRefs,
  pageBoxWidth,
}: {
  articleRefs: ChapterRefReader<HTMLElement>;
  chapters: ReaderChapterPayload[];
  fontScale: number;
  libraryItemId: string;
  onMeasurement: (entry: ReaderMeasurementEntry) => void;
  pageBoxHeight: number;
  pageBoxRefs: ChapterRefReader<HTMLDivElement>;
  pageBoxWidth: number;
}) {
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
      onMeasurement(
        measureChapterEntry({
          article: articleRefs.get(chapterId),
          pageBox: pageBoxRefs.get(chapterId),
          chapterId,
          layoutKey: createLayoutKey(chapterId),
          columnCount: resolveReaderColumnCount(pageBoxWidth),
          pageGap: PAGE_GAP,
        }),
      );
    },
    [articleRefs, createLayoutKey, onMeasurement, pageBoxRefs, pageBoxWidth],
  );

  const measureAllChapters = useCallback(() => {
    for (const chapter of chapters) {
      measureChapter(chapter.chapterId);
    }
  }, [chapters, measureChapter]);

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

  useLayoutEffect(() => {
    publishPendingMeasurements();
    measureAllChapters();

    return observeMeasurementTriggers({
      articleRefs,
      chapters,
      onTrigger: measureAllChapters,
      pageBoxRefs,
    });
  }, [
    articleRefs,
    chapters,
    measureAllChapters,
    pageBoxRefs,
    publishPendingMeasurements,
  ]);
}
