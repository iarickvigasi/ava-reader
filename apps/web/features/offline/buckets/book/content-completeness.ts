import type { ReaderBookPayload } from "@/lib/api-types/reader";
import type { BookRow } from "../../db";
import { validChapterOrder } from "./download-coverage";

export function hasCompleteStoredContent(
  book: BookRow,
  chapterIds: Set<string>,
  coverage?: { identity: string; chapterIds: string[] } | null,
): boolean {
  if (
    (book.metadata as ReaderBookPayload | undefined)?.libraryItemId !==
      book.libraryItemId ||
    !validChapterOrder(book.chapterIds) ||
    book.chapterIds.some((id) => !chapterIds.has(id))
  )
    return false;
  const canonical = book.canonical;
  if (!canonical?.readerPackage)
    return Boolean(
      book.contentRevision &&
      coverage?.identity === `epub:${book.contentRevision}` &&
      book.chapterIds.every((id) => coverage.chapterIds.includes(id)),
    );
  const source = canonical.readerPackage.book;
  return (
    source.spine.length === book.chapterIds.length &&
    source.spine.every((id, index) => id === book.chapterIds[index]) &&
    source.resources.every((resource) => {
      const prefix = `data:${resource.media_type};base64,`;
      const value = canonical.resourceUrls?.[resource.id];
      return value?.startsWith(prefix) && value.length > prefix.length;
    })
  );
}
