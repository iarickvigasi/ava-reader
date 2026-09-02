import { LibrarySource } from '@prisma/client';

// The shelf holding every book the user marked to keep offline. Membership
// tracks LibraryItem.offlineRequested rather than an import source, so it is
// deliberately absent from getSmartCollectionKey below. See
// docs/specs/4-offline/4.8-offline-books-collection.md.
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
    // sortOrder no longer decides where a shelf renders — the library and home
    // lists compute display order from engagement and size
    // (docs/specs/3-library/3.1-library-screen.md §3). It still orders the
    // book-info collection chips (items/serialize-item-collections.ts) and is
    // where a future manual reorder would land.
    sortOrder: 2,
  },
] as const;

// The shelves that partition the library: every book joins exactly the one
// matching its source, never both. Derived from the list above rather than
// spelled out again, so a new source shelf is picked up for free. Offline
// Books carries no source and is excluded — it re-lists these shelves' books.
export const SOURCE_SMART_KEYS: readonly string[] =
  DEFAULT_SMART_COLLECTIONS.filter((collection) => 'source' in collection).map(
    (collection) => collection.smartKey,
  );

export function getSmartCollectionKey(source: LibrarySource) {
  return source === LibrarySource.CATALOG
    ? 'public-domain-library'
    : 'imported-library';
}
