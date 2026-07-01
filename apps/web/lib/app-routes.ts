import type { LibraryCardBook } from "./api-types";

export const APP_LIBRARY_HREF = "/app/library";

// Extracts the single-segment slug after `prefix` from a pathname. Used by the
// generic-shell client loaders (ADR 4), which must read the slug from
// `window.location.pathname` — never `useParams()`, whose value is baked into
// a fallback-served shell document and can belong to a different slug.
export function slugFromPath(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const rest = pathname.slice(prefix.length).replace(/\/$/, "");
  if (rest.length === 0 || rest.includes("/")) {
    return null;
  }
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

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

