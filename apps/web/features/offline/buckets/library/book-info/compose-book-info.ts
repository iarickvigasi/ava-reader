import type { LibraryBookInfo } from "@/lib/api-types/library";
import type { LibraryItemRow } from "../../../db";
import type { BookInfoDetails, BookInfoOverlays } from "./types";

export function composeBookInfo(
  row: LibraryItemRow,
  details: BookInfoDetails,
  overlays: BookInfoOverlays,
): LibraryBookInfo {
  return {
    libraryItemId: row.libraryItemId,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    coverImageUrl: row.coverImageUrl,
    completionPercent: row.completionPercent,
    primaryFormat: row.primaryFormat,
    addedAt: details.addedAt,
    // Rows persisted before this field existed read back as undefined; null
    // keeps reading time on the whole-book fallback rather than crashing.
    approximateBodyPageCount: details.approximateBodyPageCount ?? null,
    approximatePageCount: details.approximatePageCount,
    chapterLabel: details.chapterLabel,
    collections: overlays.collections,
    description: details.description,
    genres: details.genres,
    finishedAt: overlays.finishedAt,
    language: details.language,
    lastReadAt: details.lastReadAt,
    minutesRead: details.minutesRead,
    readingSnapshot: details.readingSnapshot,
    publishedYear: details.publishedYear,
    source: details.source,
    hasReadableEdition: row.hasReadableEdition,
  };
}
