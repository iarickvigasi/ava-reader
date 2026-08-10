import { LibrarySource } from '@prisma/client';

// The shelf holding every book the user marked to keep offline. Membership
// tracks LibraryItem.offlineRequested rather than an import source, so it is
// deliberately absent from getSmartCollectionKey below. See
// docs/specs/17-offline-books-collection.md.
export const OFFLINE_BOOKS_SMART_KEY = 'offline-books';

export const DEFAULT_SMART_COLLECTIONS = [
  {
    smartKey: 'imported-library',
    name: 'Imported Books',
    description: 'Your personal EPUB and PDF uploads.',
    source: LibrarySource.IMPORTED,
    sortOrder: 0,
  },
  {
    smartKey: 'public-domain-library',
    name: 'Public Domain',
    description: 'Books added from the AVA public catalog.',
    source: LibrarySource.CATALOG,
    sortOrder: 1,
  },
  {
    smartKey: OFFLINE_BOOKS_SMART_KEY,
    name: 'Offline Books',
    description: "Books you've saved to read without a connection.",
    // Sorts last: its books are duplicates of the two source shelves above, and
    // this keeps the cache primer's first-seen ordering unchanged.
    sortOrder: 2,
  },
] as const;

export function getSmartCollectionKey(source: LibrarySource) {
  return source === LibrarySource.CATALOG
    ? 'public-domain-library'
    : 'imported-library';
}
