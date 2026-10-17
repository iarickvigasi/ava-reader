import { buildCoverImageUrl } from '../../shared/cover-image-url';
export function libraryCoverUrl(
  book: {
    id: string;
    coverBlob: { mimeType: string } | null;
    canonicalImportPrivate?: boolean;
    pdfImportPrivate?: boolean;
    pdfImport?: { id: string } | null;
  },
  libraryItemId: string,
): string | null {
  if (!book.coverBlob) return null;
  if (book.pdfImport)
    return `/api/library/pdf-imports/covers/${encodeURIComponent(libraryItemId)}`;
  if (book.pdfImportPrivate) return null;
  return book.canonicalImportPrivate
    ? `/api/library/epub-imports/covers/${encodeURIComponent(libraryItemId)}`
    : buildCoverImageUrl(book.id);
}
