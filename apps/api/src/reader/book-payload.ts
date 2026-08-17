import type { BookFileFormat } from '@prisma/client';
import type { OwnedLibraryItem } from './library-item-access';
import type { ReaderBookPayload } from './reader-payload-types';

// Every status carries this, so the client can show the title and resume
// position even when it cannot render the book.
export function toBookPayload(
  libraryItem: OwnedLibraryItem,
  primaryFormat: BookFileFormat,
): ReaderBookPayload {
  return {
    authors: libraryItem.book.authors,
    libraryItemId: libraryItem.id,
    primaryFormat,
    slug: libraryItem.slug,
    title: libraryItem.book.title,
  };
}
