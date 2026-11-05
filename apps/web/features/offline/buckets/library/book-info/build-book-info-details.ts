import { isOlderReadingSnapshot } from "../../../stats/is-older-reading-snapshot";
import type { BookInfoRowInput } from "./types";

export function buildBookInfoDetails(input: Omit<BookInfoRowInput, "nowIso">) {
  const { book, prior, finishedAt, retainCollections } = input;
  const reading = selectBookReading(book, prior);
  return {
    addedAt: book.addedAt,
    // Rows cached before chapter-purpose analysis existed have no body
    // count; null makes reading time fall back to the full page count.
    approximateBodyPageCount: book.approximateBodyPageCount ?? null,
    approximatePageCount: book.approximatePageCount,
    chapterLabel: book.chapterLabel,
    collections:
      retainCollections && prior?.details
        ? prior.details.collections
        : book.collections,
    description: book.description,
    genres: book.genres,
    // An offline route can hydrate its own overlaid cached payload. Keep
    // the server baseline until sync acknowledges the pending value.
    finishedAt,
    language: book.language,
    // The details payload's lastReadAt is the strict
    // ReadingProgress.lastReadAt (nullable). The list payload's
    // lastReadAt is the broader "engagement" timestamp. Both have
    // value; we keep the strict one on `details` and the engagement
    // one at the top level (`row.lastReadAt`) so each consumer reads
    // what it expects.
    lastReadAt: book.lastReadAt,
    minutesRead: reading.minutesRead,
    readingSnapshot: reading.readingSnapshot,
    publishedYear: book.publishedYear,
    source: book.source,
  };
}

function selectBookReading(
  book: BookInfoRowInput["book"],
  prior: BookInfoRowInput["prior"],
) {
  return prior?.details &&
    isOlderReadingSnapshot(book.readingSnapshot, prior.details.readingSnapshot)
    ? prior.details
    : book;
}
