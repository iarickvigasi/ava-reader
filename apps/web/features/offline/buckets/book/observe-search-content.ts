import { liveQuery } from "dexie";
import { getDb } from "../../db";

// Observe existing content; never maintain a second search index.
export function observeSearchContent(libraryItemId: string) {
  const db = getDb();
  return liveQuery(async () => {
    const [book, chapters] = await Promise.all([
      db.books.get(libraryItemId),
      db.bookChapters.where("libraryItemId").equals(libraryItemId).toArray(),
    ]);
    return { book, chapters };
  });
}
