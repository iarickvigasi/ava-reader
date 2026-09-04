// The book-info page's cache: the detail fields the library/collection
// payloads don't carry, layered onto the row they already wrote. Cached so the
// page works offline once the user has visited it online at least once.

import type { LibraryBookInfo } from "@/lib/api-types/library";

import { getDb, type LibraryItemRow } from "../../db";

// Writes the full LibraryBookInfo into the row identified by libraryItemId.
// Used by the book-info page hydrator after either of its server fetches.
export async function applyBookInfoPayload(
  book: LibraryBookInfo,
): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await db.transaction("rw", db.libraryItems, async () => {
    const prior = await db.libraryItems.get(book.libraryItemId);
    const next: LibraryItemRow = {
      libraryItemId: book.libraryItemId,
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      coverImageUrl: book.coverImageUrl,
      completionPercent: book.completionPercent,
      primaryFormat: book.primaryFormat,
      lastReadAt: book.lastReadAt ?? prior?.lastReadAt ?? null,
      coverBlob: prior?.coverBlob ?? null,
      savedOffline: prior?.savedOffline ?? false,
      savedAutomatically: prior?.savedAutomatically ?? false,
      savedAt: prior?.savedAt ?? null,
      // Deliberately not mergeListPayloadItemRow (item-row.ts): this payload
      // *does* carry the intent, so the fallbacks below differ from the list
      // path's. Kept separate rather than unified — see 4.2-save-sync.
      // Preserve the server-synced "keep offline" intent. A local unsynced
      // toggle (dirty) wins; otherwise take this payload's value, then the
      // prior cached value. Without this, a book-info re-hydration wipes the
      // flag the library/collection writes set — which silently starves the
      // cache primer of its targets (see [[4.2-save-sync]]).
      offlineRequested: prior?.offlineRequestedDirty
        ? (prior.offlineRequested ?? false)
        : (book.offlineRequested ?? prior?.offlineRequested ?? false),
      offlineRequestedDirty: prior?.offlineRequestedDirty ?? false,
      // Straight from the payload, even when a dirty local toggle wins above:
      // that difference is exactly what the shelf's count needs to see.
      offlineRequestedBaseline:
        book.offlineRequested ?? prior?.offlineRequestedBaseline ?? false,
      serverUpdatedAt: prior?.serverUpdatedAt ?? nowIso,
      details: {
        addedAt: book.addedAt,
        // Rows cached before chapter-purpose analysis existed have no body
        // count; null makes reading time fall back to the full page count.
        approximateBodyPageCount: book.approximateBodyPageCount ?? null,
        approximatePageCount: book.approximatePageCount,
        chapterLabel: book.chapterLabel,
        collections: book.collections,
        description: book.description,
        genres: book.genres,
        language: book.language,
        // The details payload's lastReadAt is the strict
        // ReadingProgress.lastReadAt (nullable). The list payload's
        // lastReadAt is the broader "engagement" timestamp. Both have
        // value; we keep the strict one on `details` and the engagement
        // one at the top level (`row.lastReadAt`) so each consumer reads
        // what it expects.
        lastReadAt: book.lastReadAt,
        minutesRead: book.minutesRead,
        publishedYear: book.publishedYear,
        source: book.source,
      },
      detailsFetchedAt: nowIso,
    };
    await db.libraryItems.put(next);
  });
}
