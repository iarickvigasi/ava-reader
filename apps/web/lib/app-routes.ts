export const APP_LIBRARY_HREF = "/app/library";

export function getReaderHref(slug: string) {
  return `/app/read/${slug}`;
}

export function getCollectionHref(slug: string) {
  return `/app/library/collections/${slug}`;
}

export type LibraryBookInfoLinkCard = {
  authors: string[];
  coverImageUrl: null | string;
  title: string;
};

export function getLibraryBookInfoHref(
  slug: string,
  input?: {
    card?: LibraryBookInfoLinkCard;
    fromCollectionSlug?: string;
  },
) {
  const baseHref = `/app/library/books/${slug}`;
  const params = new URLSearchParams();

  if (input?.fromCollectionSlug) {
    params.set("fromCollection", input.fromCollectionSlug);
  }
  if (input?.card) {
    // Card hints let the book-info page paint a header instantly while the
    // full payload streams in. They're optional — the page works without them
    // (direct nav, refresh) and falls back to fetching all fields.
    params.set("title", input.card.title);
    for (const author of input.card.authors) {
      params.append("author", author);
    }
    if (input.card.coverImageUrl) {
      params.set("cover", input.card.coverImageUrl);
    }
  }

  const qs = params.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}
