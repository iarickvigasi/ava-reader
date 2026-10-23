import { getDb, type LibraryItemRow } from "../../db";
import { writeUnlessDeleted } from "../library/deleted-items";
export type SaveKind = "auto" | "explicit";

export async function markBookSaved(
  libraryItemId: string,
  kind: SaveKind,
): Promise<void> {
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  if (!row) {
    // The book has never been listed; we can't mark it saved without a row.
    // Caller should have ensured the library bucket has hydrated this book
    // before calling save (the reader page always has, via book-info / library
    // navigation). Bail quietly rather than write a half-row.
    return;
  }
  const nowIso = new Date().toISOString();
  const next: LibraryItemRow = {
    ...row,
    savedOffline: kind === "explicit" ? true : row.savedOffline,
    savedAutomatically: kind === "auto" ? true : row.savedAutomatically,
    savedAt: row.savedAt ?? nowIso,
  };
  await writeUnlessDeleted(db, libraryItemId, [db.libraryItems], () =>
    db.libraryItems.put(next),
  );
}
