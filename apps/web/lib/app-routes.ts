export const APP_LIBRARY_HREF = "/app/library";

export function getReaderHref(slug: string) {
  return `/app/read/${slug}`;
}

export function getLibraryBookInfoHref(
  slug: string,
  input?: {
    fromCollectionId?: string;
  },
) {
  const baseHref = `/app/library/books/${slug}`;
  const fromCollectionId = input?.fromCollectionId;

  if (!fromCollectionId) {
    return baseHref;
  }

  return `${baseHref}?fromCollection=${encodeURIComponent(fromCollectionId)}`;
}
