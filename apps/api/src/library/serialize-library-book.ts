import { BookFileFormat, type BookFileKind } from '@prisma/client';
import { buildCoverImageUrl } from '../shared/cover-image-url';
import { findPrimarySourceFile } from '../shared/primary-book-file';

type LibraryBookItem = {
  book: {
    authors: string[];
    coverBlob: { mimeType: string } | null;
    files: {
      format: BookFileFormat;
      isPrimary: boolean;
      kind: BookFileKind;
    }[];
    id: string;
    title: string;
  };
  id: string;
  offlineRequested: boolean;
  slug: string;
};

// The one card shape every book list renders — library overview sections and
// collection pages (home mirrors it). See docs/specs/7-library/_overview.md.
export function serializeLibraryBook(
  item: LibraryBookItem,
  engagement: { completionPercent: number; lastReadAt: Date },
) {
  return {
    authors: item.book.authors,
    completionPercent: engagement.completionPercent,
    coverImageUrl: item.book.coverBlob
      ? buildCoverImageUrl(item.book.id)
      : null,
    lastReadAt: engagement.lastReadAt.toISOString(),
    libraryItemId: item.id,
    offlineRequested: item.offlineRequested,
    primaryFormat:
      findPrimarySourceFile(item.book.files)?.format ?? BookFileFormat.UNKNOWN,
    slug: item.slug,
    title: item.book.title,
  };
}
