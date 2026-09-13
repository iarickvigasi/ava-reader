import type { PrismaService } from '../prisma/prisma.service';
import { buildCoverImageUrl } from '../shared/cover-image-url';
import { findPrimarySourceFile } from '../shared/primary-book-file';
import type { CatalogEntryRecord } from './types';

const HOME_CATALOG_LIMIT = 2;

export async function loadHomeCatalog(prisma: PrismaService) {
  const entries = await prisma.catalogEntry.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      book: {
        include: {
          coverBlob: { select: { mimeType: true } },
          files: { select: { format: true, isPrimary: true, kind: true } },
        },
      },
    },
  });

  return entries
    .sort(compareCatalogEntries)
    .slice(0, HOME_CATALOG_LIMIT)
    .map(serializeCatalogEntry);
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

function serializeCatalogEntry(entry: CatalogEntryRecord) {
  const primarySource = findPrimarySourceFile(entry.book.files);

  return {
    authors: entry.book.authors,
    coverImageUrl: entry.book.coverBlob
      ? buildCoverImageUrl(entry.book.id)
      : null,
    description: entry.editorialDescription ?? entry.book.description,
    id: entry.id,
    isFeatured: entry.isFeatured,
    primaryFormat: primarySource?.format ?? 'UNKNOWN',
    title: entry.editorialTitle ?? entry.book.title,
  };
}
