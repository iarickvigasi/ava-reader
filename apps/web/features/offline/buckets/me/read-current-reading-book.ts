import { getDb } from "../../db";
import { readCurrentUser } from "./storage";
import { selectCurrentReadingBook } from "./select-current-reading-book";

export async function readCurrentReadingBook() {
  const db = getDb();
  return db.transaction(
    "r",
    [db.me, db.meta, db.libraryItems, db.progress, db.finishDateMutations],
    async () => {
      const [user, books, progress, finishDates] = await Promise.all([
        readCurrentUser(),
        db.libraryItems.toArray(),
        db.progress.toArray(),
        db.finishDateMutations.toArray(),
      ]);
      return selectCurrentReadingBook({
        server: user?.currentReadingBook ?? null,
        books,
        progress,
        finishDates,
      });
    },
  );
}
