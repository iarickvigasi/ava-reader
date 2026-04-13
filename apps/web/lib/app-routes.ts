export const APP_HOME_HREF = "/app";
export const APP_LIBRARY_HREF = "/app/library";

export function getLibraryBookInfoHref(
  libraryItemId: string,
  input?: {
    fromCollectionId?: string;
  },
) {
  const baseHref = `/app/library/books/${libraryItemId}`;
  const fromCollectionId = input?.fromCollectionId;

  if (!fromCollectionId) {
    return baseHref;
  }

  return `${baseHref}?fromCollection=${encodeURIComponent(fromCollectionId)}`;
}
