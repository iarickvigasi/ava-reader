import type { ReaderChapterPayload } from "@/lib/api-types/reader";
import { readableChapterLabel } from "@/features/reader/readable-chapter-label";
import type { ReadyReaderPayload } from "./types";
import { formatReaderChapterLabel } from "./utils";

export function formatReaderHeaderParts(
  payload: ReadyReaderPayload,
  chapter: ReaderChapterPayload,
) {
  return {
    title: payload.book.title,
    author: payload.book.authors[0],
    chapter: formatReaderChapterLabel(
      readableChapterLabel(chapter, payload.toc),
    ),
  };
}
