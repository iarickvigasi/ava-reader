import type { LibraryBookInfo } from "@/lib/api-types/library";
import type { LibraryItemRow } from "../../../db";

export function buildBookInfoRow(input: {
  book: LibraryBookInfo;
  prior: LibraryItemRow | undefined;
  finishedAt: string | null;
  retainCollections: boolean;
  nowIso: string;
}): LibraryItemRow {
  const { book, prior, finishedAt, retainCollections, nowIso } = input;
  return {
    libraryItemId: book.libraryItemId,
    source: book.source,
    hasReadableEdition: book.hasReadableEdition ?? prior?.hasReadableEdition,
    slug: book.slug,
    title: book.title,
    authors: book.authors,
    coverImageUrl: book.coverImageUrl,
    completionPercent: book.completionPercent,
    finishedAt,
    primaryFormat: book.primaryFormat,
    lastReadAt: book.lastReadAt ?? prior?.lastReadAt ?? null,
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
      collections:
        retainCollections && prior?.details
          ? prior.details.collections
          : book.collections,
      description: book.description,
      genres: book.genres,
      // An offline route can hydrate its own overlaid cached payload. Keep
      // the server baseline until sync acknowledges the pending value.
      finishedAt,
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
}
