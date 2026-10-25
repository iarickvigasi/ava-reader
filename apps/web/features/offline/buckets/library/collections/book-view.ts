import type { LibraryItemRow } from "../../../db";
import type { LibraryBookView } from "../types";

export function toBookView(row: LibraryItemRow): LibraryBookView {
  const finishedAt =
    row.finishedAt !== undefined ? row.finishedAt : row.details?.finishedAt;
  return {
    libraryItemId: row.libraryItemId,
    source: row.source ?? row.details?.source,
    hasReadableEdition: row.hasReadableEdition,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    coverImageUrl: row.coverImageUrl,
    completionPercent: row.completionPercent,
    ...(finishedAt !== undefined ? { finishedAt } : {}),
    primaryFormat: row.primaryFormat,
    lastReadAt: row.lastReadAt,
    savedOffline: row.savedOffline,
    offlineRequested: row.offlineRequested ?? false,
  };
}
