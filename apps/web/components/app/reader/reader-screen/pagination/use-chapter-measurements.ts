import { useCallback, useLayoutEffect } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import {
  createFailedReaderMeasurementEntry,
  createPendingReaderMeasurementEntry,
  createReadyReaderMeasurementEntry,
  type ReaderMeasurementEntry,
} from "@/features/reader/measurement";
import { createPaginationLayoutKey } from "@/features/reader/pagination";
import { PAGE_GAP } from "../shared/constants";
import { resolveReaderColumnCount } from "../shared/utils";

type ChapterRefReader<T extends Element> = {
  get: (chapterId: string) => T | null;
};

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
            columnCount: resolveReaderColumnCount(pageBoxWidth),
            layoutKey,
            pageBox,
            pageGap: PAGE_GAP,
          }),
        );
      } catch {
        onMeasurement(createFailedReaderMeasurementEntry({ chapterId, layoutKey }));
      }
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

// Observes article/pageBox size changes and image loads for every
// chapter, calling `onTrigger` whenever the layout could change.
function observeMeasurementTriggers({
  articleRefs,
  chapters,
  onTrigger,
  pageBoxRefs,
}: {
  articleRefs: ChapterRefReader<HTMLElement>;
  chapters: ReaderChapterPayload[];
  onTrigger: () => void;
  pageBoxRefs: ChapterRefReader<HTMLDivElement>;
}): () => void {
  const resizeObserver = new ResizeObserver(onTrigger);
  const trackedImages: HTMLImageElement[] = [];

  for (const chapter of chapters) {
    const article = articleRefs.get(chapter.chapterId);
    const pageBox = pageBoxRefs.get(chapter.chapterId);

    if (article) {
      resizeObserver.observe(article);
      for (const image of article.querySelectorAll<HTMLImageElement>("img")) {
        image.addEventListener("load", onTrigger);
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
      image.removeEventListener("load", onTrigger);
    }
  };
}
