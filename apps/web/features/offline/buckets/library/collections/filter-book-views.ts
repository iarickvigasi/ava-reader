import type { AvaReaderDB } from "../../../db";
import type { LibraryBookView } from "../types";
import {
  effectiveCompletion,
  type CompletionContext,
} from "../../../completion/counts";

// Match hasBookContent: a completed book row plus its first chapter (or an empty book).
export async function enrichFilterBooks(
  db: AvaReaderDB,
  books: LibraryBookView[],
  context: CompletionContext,
  revision: number,
) {
  const ready = new Set<string>();
  for (const book of await db.books.toArray()) {
    if (
      book.chapterIds.length === 0 ||
      (await db.bookChapters.get([book.libraryItemId, book.chapterIds[0]]))
    ) {
      ready.add(book.libraryItemId);
    }
  }
  return books.map((book) => ({
    ...book,
    availableOffline: ready.has(book.libraryItemId),
    ...effectiveCompletion(
      {
        libraryItemId: book.libraryItemId,
        finishedAt: book.finishedAt ?? null,
        completionPercent: book.completionPercent,
      },
      revision,
      context,
    ),
  }));
}
