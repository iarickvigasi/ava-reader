export const APP_LIBRARY_HREF = "/app/library";

export function getReaderHref(slug: string) {
  return `/app/read/${slug}`;
}

export function getCollectionHref(slug: string) {
  return `/app/library/collections/${slug}`;
}

export function getLibraryBookInfoHref(
  slug: string,
  input?: {
    fromCollectionSlug?: string;
  },
) {
  const baseHref = `/app/library/books/${slug}`;
  const fromCollectionSlug = input?.fromCollectionSlug;

  if (!fromCollectionSlug) {
    return baseHref;
  }

  return `${baseHref}?fromCollection=${encodeURIComponent(fromCollectionSlug)}`;
}
