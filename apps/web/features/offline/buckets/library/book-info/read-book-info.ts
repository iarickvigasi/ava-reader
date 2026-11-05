import type { LibraryBookInfo } from "@/lib/api-types/library";
import { getDb, type AvaReaderDB, type LibraryItemRow } from "../../../db";
import { overlayBookCollections } from "../membership/selectors";
import { composeBookInfo } from "./compose-book-info";
import type { BookInfoDetails, BookInfoOverlays } from "./types";

// Detail fields are available offline after the book-info page has been cached.
export async function readBookInfoBySlug(
  slug: string,
): Promise<LibraryBookInfo | null> {
  const db = getDb();
  return db.transaction(
    "r",
    [
      db.libraryItems,
      db.finishDateMutations,
      db.collectionMembershipMutations,
      db.collections,
    ],
    () => readBookInfoSnapshot(db, slug),
  );
}

async function readBookInfoSnapshot(db: AvaReaderDB, slug: string) {
  const row = await db.libraryItems.where("slug").equals(slug).first();
  if (!row?.details) return null;
  const overlays = await loadBookInfoOverlays(db, row, row.details);
  return composeBookInfo(row, row.details, overlays);
}

async function loadBookInfoOverlays(
  db: AvaReaderDB,
  row: LibraryItemRow,
  details: BookInfoDetails,
): Promise<BookInfoOverlays> {
  const [finishDate, membership, collections] = await Promise.all([
    db.finishDateMutations.get(row.libraryItemId),
    db.collectionMembershipMutations.get(row.libraryItemId),
    db.collections.toArray(),
  ]);
  return {
    collections: overlayBookCollections(
      details.collections,
      membership,
      collections,
    ),
    // A queued clear (null) must win just as a queued date does.
    finishedAt: finishDate
      ? finishDate.finishedAt
      : row.finishedAt !== undefined
        ? row.finishedAt
        : (details.finishedAt ?? null),
  };
}
