import type { ReaderChapterPayload } from "@/lib/api-types";
import type { ChapterRefReader } from "./use-chapter-ref-map";

// Observes article/pageBox size changes and image loads for every chapter,
// calling `onTrigger` whenever the layout could change. Returns a cleanup fn
// that disconnects the observer and removes the image listeners.
export function observeMeasurementTriggers({
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
  const handlePageShow = () => onTrigger();
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      onTrigger();
    }
  };

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

  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.fonts?.addEventListener("loadingdone", onTrigger);

  return () => {
    resizeObserver.disconnect();
    window.removeEventListener("pageshow", handlePageShow);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.fonts?.removeEventListener("loadingdone", onTrigger);
    for (const image of trackedImages) {
      image.removeEventListener("load", onTrigger);
    }
  };
}
