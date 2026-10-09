import type { LibraryItemRow, ProgressRow } from "../../db";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import type { FinishDateMutation } from "../library/finish-date/types";

type ReadingBook = NonNullable<CurrentUserPayload["currentReadingBook"]>;

export function selectCurrentReadingBook({
  server,
  books,
  progress,
  finishDates,
}: {
  server: ReadingBook | null;
  books: LibraryItemRow[];
  progress: ProgressRow[];
  finishDates: FinishDateMutation[];
}): ReadingBook | null {
  const byId = new Map(books.map((book) => [book.libraryItemId, book]));
  const progressById = new Map(progress.map((row) => [row.libraryItemId, row]));
  const finished = new Map(
    finishDates.map((row) => [row.libraryItemId, row.finishedAt]),
  );
  const candidates: ReadingBook[] = server ? [server] : [];
  for (const row of progress) {
    const book = byId.get(row.libraryItemId);
    if (book && row.lastReadAt)
      candidates.push({
        libraryItemId: row.libraryItemId,
        title: book.title,
        authors: book.authors,
        lastReadAt: row.lastReadAt,
      });
  }
  return (
    candidates
      .filter((candidate) => {
        const book = byId.get(candidate.libraryItemId);
        const completion =
          progressById.get(candidate.libraryItemId)?.completionPercent ??
          book?.completionPercent ??
          0;
        const finishedAt = finished.has(candidate.libraryItemId)
          ? finished.get(candidate.libraryItemId)
          : book?.finishedAt;
        return !finishedAt && completion < 100;
      })
      .sort(
        (a, b) =>
          b.lastReadAt.localeCompare(a.lastReadAt) ||
          a.libraryItemId.localeCompare(b.libraryItemId),
      )[0] ?? null
  );
}
