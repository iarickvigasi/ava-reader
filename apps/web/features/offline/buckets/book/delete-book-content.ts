import { getDb, type LibraryItemRow } from "../../db";
import { forgetWarmCover } from "./warm-cover";

// Deletes the book row + every chapter row + cover blob. Clears the saved-*
// flags on the LibraryItem row so the UI reflects "not downloaded". Does
// NOT remove the LibraryItem row itself — that's owned by the library
// bucket and reflects whether the user has the book in their library at all.
export async function deleteBookContent(libraryItemId: string): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    [db.books, db.bookChapters, db.libraryItems, db.bookCovers],
    async () => {
      await db.books.delete(libraryItemId);
      await db.bookCovers.delete(libraryItemId);
      await db.bookChapters
        .where("[libraryItemId+chapterId]")
        .between([libraryItemId, ""], [libraryItemId, "￿"])
        .delete();
      const row = await db.libraryItems.get(libraryItemId);
      if (row) {
        const next: LibraryItemRow = {
          ...row,
          savedOffline: false,
          savedAutomatically: false,
          savedAt: null,
        };
        await db.libraryItems.put(next);
      }
    },
  );
  forgetWarmCover(libraryItemId);
}
