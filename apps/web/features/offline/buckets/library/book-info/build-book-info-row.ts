import type { LibraryItemRow } from "../../../db";
import { buildBookInfoDetails } from "./build-book-info-details";
import type { BookInfoRowInput } from "./types";

export function buildBookInfoRow(input: BookInfoRowInput): LibraryItemRow {
  const { book, prior, finishedAt, nowIso } = input;
  const offlineIntent = resolveOfflineIntent(book, prior);
  const details = buildBookInfoDetails(input);
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
    ...offlineIntent,
    serverUpdatedAt: prior?.serverUpdatedAt ?? nowIso,
    details,
    detailsFetchedAt: nowIso,
  };
}

function resolveOfflineIntent(
  book: BookInfoRowInput["book"],
  prior: BookInfoRowInput["prior"],
) {
  // Dirty local intent wins, while the baseline keeps the incoming server value.
  // Detail payloads carry this flag; list payloads use different merge fallbacks.
  return {
    offlineRequested: prior?.offlineRequestedDirty
      ? (prior.offlineRequested ?? false)
      : (book.offlineRequested ?? prior?.offlineRequested ?? false),
    offlineRequestedDirty: prior?.offlineRequestedDirty ?? false,
    offlineRequestedBaseline:
      book.offlineRequested ?? prior?.offlineRequestedBaseline ?? false,
  };
}
