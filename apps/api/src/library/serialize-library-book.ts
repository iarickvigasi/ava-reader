import { hasReadableEdition } from './has-readable-edition';
import {
  BookFileFormat,
  type BookFileKind,
  type LibrarySource,
} from '@prisma/client';
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
  source?: LibrarySource;
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
    source: item.source,
    hasReadableEdition: hasReadableEdition(item.book.files),
    completionPercent: engagement.completionPercent,
    finishedAt: item.finishedAt?.toISOString() ?? null,
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
