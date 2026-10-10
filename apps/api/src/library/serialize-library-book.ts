import {
  pdfLibrarySummary,
  type PdfLibraryRecord,
} from './pdf-import/operations/library-summary';
import { BookFileFormat, type BookFileKind } from '@prisma/client';
import { libraryCoverUrl } from './covers/library-cover-url';
import { findPrimarySourceFile } from '../shared/primary-book-file';

type LibraryBookItem = {
  book: {
    pdfImport?: PdfLibraryRecord | null;
    canonicalImportPrivate?: boolean;
    pdfImportPrivate?: boolean;
    authors: string[];
    coverBlob: { mimeType: string } | null;
    files: {
      format: BookFileFormat;
      isPrimary: boolean;
      kind: BookFileKind;
    }[];
    id: string;
    title: string;
    metadataEditVersion?: number;
  };
  id: string;
  finishedAt: Date | null;
  offlineRequested: boolean;
  slug: string;
};

// The one card shape every book list renders — library overview sections and
// collection pages (home mirrors it). See docs/specs/3-library/_overview.md.
export function serializeLibraryBook(
  item: LibraryBookItem,
  engagement: { completionPercent: number; lastReadAt: Date },
) {
  return {
    authors: item.book.authors,
    metadataEditVersion: item.book.metadataEditVersion,
    pdfImport: pdfLibrarySummary(item.book.pdfImport),
    completionPercent: engagement.completionPercent,
    finishedAt: item.finishedAt?.toISOString() ?? null,
    coverImageUrl: libraryCoverUrl(item.book, item.id),
    lastReadAt: engagement.lastReadAt.toISOString(),
    libraryItemId: item.id,
    offlineRequested: item.offlineRequested,
    primaryFormat:
      findPrimarySourceFile(item.book.files)?.format ?? BookFileFormat.UNKNOWN,
    slug: item.slug,
    title: item.book.title,
  };
}
