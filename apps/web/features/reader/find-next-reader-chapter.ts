import type { ReadyReaderProps } from "@/components/app/reader/shared/types";

export function findNextReaderChapter({
  payload,
  activeChapter,
}: ReadyReaderProps) {
  return payload.chapters.find(
    (chapter) => chapter.chapterId === activeChapter.nextChapterId,
  );
}
