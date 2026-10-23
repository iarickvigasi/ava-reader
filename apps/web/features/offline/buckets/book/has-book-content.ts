import { getDb } from "../../db";

// True when the book has its full content (book row + at least one chapter)
// — what the BookContext uses to decide "missing-offline" vs "ready".
// Stricter checks (do we have *all* chapters?) are deferred to the bucket,
// which knows the expected count.
export async function hasBookContent(libraryItemId: string): Promise<boolean> {
  const db = getDb();
  const book = await db.books.get(libraryItemId);
  if (!book) {
    return false;
  }
  // Verify at least the first chapter is present. A successful save writes
  // BookRow last (after all chapters), so the presence of BookRow alone is
  // a reliable signal — but checking one chapter row is a cheap belt.
  if (book.chapterIds.length === 0) {
    return true;
  }
  const first = await db.bookChapters.get([libraryItemId, book.chapterIds[0]]);
  return !!first;
}
