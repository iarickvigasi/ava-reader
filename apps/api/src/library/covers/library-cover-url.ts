import { buildCoverImageUrl } from '../../shared/cover-image-url';
export function libraryCoverUrl(
  book: {
    id: string;
    coverBlob: { mimeType: string } | null;
    canonicalImportPrivate?: boolean;
    pdfImportPrivate?: boolean;
    pdfImport?: unknown;
  },
  libraryItemId: string,
): string | null {
  if (!book.coverBlob || book.pdfImportPrivate || book.pdfImport) return null;
  return book.canonicalImportPrivate
    ? `/api/library/epub-imports/covers/${encodeURIComponent(libraryItemId)}`
    : buildCoverImageUrl(book.id);
}
