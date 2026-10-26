import type { BookRow, ChapterRow } from "@/features/offline/db";

type Snapshot = { book?: BookRow; chapters: ChapterRow[] };
export function sameSearchCache(previous: Snapshot, next: Snapshot) {
  return (
    previous.book?.fetchedAt === next.book?.fetchedAt &&
    previous.chapters.length === next.chapters.length &&
    previous.chapters.every((chapter, index) => {
      const other = next.chapters[index];
      return (
        chapter.chapterId === other.chapterId &&
        chapter.fetchedAt === other.fetchedAt
      );
    })
  );
}
