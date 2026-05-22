import type { LibraryCardBook } from "./api-types";
import type { BookFileFormat } from
    "@/lib/api-types";

export const APP_LIBRARY_HREF = "/app/library";

export function getReaderHref(slug: string) {
  return `/app/read/${slug}`;
}

export function getCollectionHref(slug: string) {
  return `/app/library/collections/${slug}`;
}

// The book-info page accepts a snapshot of the card the user clicked from.
// When the snapshot is complete the page can render the screen immediately
// from URL state and fetch only the detail delta (description, genres, etc.)
// instead of refetching fields it already knows.
export function getLibraryBookInfoHref(
  slug: string,
  input?: {
    card?: LibraryCardBook;
    fromCollectionSlug?: string;
  },
) {
  const baseHref = `/app/library/books/${slug}`;
  const params = new URLSearchParams();

  if (input?.fromCollectionSlug) {
    params.set("fromCollection", input.fromCollectionSlug);
  }
  if (input?.card) {
    const card = input.card;
    params.set("title", card.title);
    for (const author of card.authors) {
      params.append("author", author);
    }
    if (card.coverImageUrl) {
      params.set("cover", card.coverImageUrl);
    }
    params.set("liid", card.libraryItemId);
    params.set("progress", String(card.completionPercent));
    params.set("format", card.primaryFormat);
  }

  const qs = params.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}

// Read a LibraryCardBook back from URL search params. Returns null if any
// required field is missing — direct navigation or refresh has no hints and
// the page falls back to fetching everything from the server.
export function parseLibraryCardFromSearch(
  search: Record<string, string | string[] | undefined>,
  slug: string,
): LibraryCardBook | null {
  const title = pickOne(search.title);
  const authors = pickMany(search.author);
  const libraryItemId = pickOne(search.liid);
  const progress = pickOne(search.progress);
  const format = pickOne(search.format);
  if (!title || !libraryItemId || !progress || !format) {
    return null;
  }
  const completionPercent = Number.parseInt(progress, 10);
  if (Number.isNaN(completionPercent)) {
    return null;
  }
  return {
    authors,
    completionPercent,
    coverImageUrl: pickOne(search.cover) ?? null,
    libraryItemId,
    primaryFormat: format as BookFileFormat,
    slug,
    title,
  };
}

function pickOne(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function pickMany(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}
