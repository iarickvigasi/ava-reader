import type { BookRow, ChapterRow } from "@/features/offline/db";
import type { ReaderChapterPayload, ReaderTocNode } from "@/lib/api-types";
import { collectTocChapterEntries } from "../toc";

export function mergeSearchContent(
  cache: { book?: BookRow; chapters: ChapterRow[]; error: boolean },
  toc: ReaderTocNode[],
  window: ReaderChapterPayload[],
) {
  const labels = collectTocChapterEntries(toc);
  const byId = new Map(
    window.map((chapter) => [
      chapter.chapterId,
      {
        chapterId: chapter.chapterId,
        blocks: chapter.blocks,
        order: chapter.spineIndex,
        label:
          labels.get(chapter.chapterId)?.label ||
          chapter.label ||
          chapter.title ||
          `${chapter.spineIndex + 1}.`,
      },
    ]),
  );
  for (const chapter of cache.chapters) {
    const order = labels.get(chapter.chapterId)?.spineIndex ?? chapter.index;
    byId.set(chapter.chapterId, {
      chapterId: chapter.chapterId,
      blocks: chapter.blocks,
      order,
      label:
        labels.get(chapter.chapterId)?.label ||
        byId.get(chapter.chapterId)?.label ||
        `${order + 1}.`,
    });
  }
  const cachedIds = new Set(cache.chapters.map((chapter) => chapter.chapterId));
  return {
    chapters: [...byId.values()].sort((a, b) => a.order - b.order),
    complete:
      !!cache.book?.chapterIds.length &&
      cache.book.chapterIds.every((id) => cachedIds.has(id)),
    error: cache.error,
  };
}
