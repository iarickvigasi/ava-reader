import { LibrarySource } from '@prisma/client';

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
] as const;

export function getSmartCollectionKey(source: LibrarySource) {
  return source === LibrarySource.CATALOG
    ? 'public-domain-library'
    : 'imported-library';
}
