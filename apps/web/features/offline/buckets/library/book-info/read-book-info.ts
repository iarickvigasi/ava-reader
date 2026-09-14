// The book-info page's cache: the detail fields the library/collection
// payloads don't carry, layered onto the row they already wrote. Cached so the
// page works offline once the user has visited it online at least once.

import type { LibraryBookInfo } from "@/lib/api-types/library";

import { getDb, type AvaReaderDB } from "../../../db";
import { overlayBookCollections } from "../membership/selectors";

// Reads back a full LibraryBookInfo from Dexie. Returns null when either the
// row is missing or details have never been fetched — the page falls back to
// its instructional "open online to download" UX in that case.
export async function readBookInfoBySlug(
  slug: string,
): Promise<LibraryBookInfo | null> {
  const db = getDb();
  return db.transaction("r", [db.libraryItems, db.finishDateMutations, db.collectionMembershipMutations, db.collections],
    () => readBookInfoSnapshot(db, slug));
}

async function readBookInfoSnapshot(db: AvaReaderDB, slug: string): Promise<LibraryBookInfo | null> {
  const row = await db.libraryItems.where("slug").equals(slug).first();
  if (!row || !row.details) {
    return null;
  }
  const finishDate = await db.finishDateMutations.get(row.libraryItemId);
  return {
    libraryItemId: row.libraryItemId,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    coverImageUrl: row.coverImageUrl,
    completionPercent: row.completionPercent,
    primaryFormat: row.primaryFormat,
    addedAt: row.details.addedAt,
    // Rows persisted before this field existed read back as undefined; null
    // keeps reading time on the whole-book fallback rather than crashing.
    approximateBodyPageCount: row.details.approximateBodyPageCount ?? null,
    approximatePageCount: row.details.approximatePageCount,
    chapterLabel: row.details.chapterLabel,
    collections: overlayBookCollections(
      row.details.collections,
      await db.collectionMembershipMutations.get(row.libraryItemId),
      await db.collections.toArray(),
    ),
    description: row.details.description,
    genres: row.details.genres,
    // A queued clear (null) must win just as a queued date does.
    finishedAt: finishDate ? finishDate.finishedAt
      : row.finishedAt !== undefined ? row.finishedAt : row.details.finishedAt ?? null,
    language: row.details.language,
    lastReadAt: row.details.lastReadAt,
    minutesRead: row.details.minutesRead,
    publishedYear: row.details.publishedYear,
    source: row.details.source,
  };
}
