import { PUBLIC_CATALOG_BOOK } from '../shared/private-book-access';
import type { PrismaService } from '../prisma/prisma.service';
import { loadCatalogCovers } from './load-catalog-covers';
import { findPrimarySourceFile } from '../shared/primary-book-file';
import type { CatalogEntryRecord } from './types';

const HOME_CATALOG_LIMIT = 2;

export async function loadHomeCatalog(prisma: PrismaService) {
  const entries = await prisma.catalogEntry.findMany({
    where: { status: 'PUBLISHED', book: PUBLIC_CATALOG_BOOK },
    include: {
      book: {
        include: {
          files: { select: { format: true, isPrimary: true, kind: true } },
        },
      },
    },
  });

  const featured = entries
    .sort(compareCatalogEntries)
    .slice(0, HOME_CATALOG_LIMIT);
  const covers = await loadCatalogCovers(featured.map(({ id }) => id));
  return featured.map((entry) =>
    serializeCatalogEntry(entry, covers.get(entry.id)),
  );
}

function compareCatalogEntries(
  left: CatalogEntryRecord,
  right: CatalogEntryRecord,
) {
  if (left.isFeatured !== right.isFeatured) {
    return left.isFeatured ? -1 : 1;
  }

  if ((left.featuredRank ?? Infinity) !== (right.featuredRank ?? Infinity)) {
    return (left.featuredRank ?? Infinity) - (right.featuredRank ?? Infinity);
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function serializeCatalogEntry(
  entry: CatalogEntryRecord,
  mapping?: { coverImageUrl: string | null; editionId?: string },
) {
  const primarySource = findPrimarySourceFile(entry.book.files);

  return {
    authors: entry.book.authors,
    coverImageUrl: mapping?.coverImageUrl ?? null,
    editionId: mapping?.editionId ?? null,
    description: entry.editorialDescription ?? entry.book.description,
    id: entry.id,
    isFeatured: entry.isFeatured,
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    title: entry.editorialTitle ?? entry.book.title,
  };
}
