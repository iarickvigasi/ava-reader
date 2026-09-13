import { BookFileFormat } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { buildCoverImageUrl } from '../../shared/cover-image-url';
import { findPrimarySourceFile } from '../../shared/primary-book-file';
import { ownedLibraryItemWhere } from './library-item-access';
import { sortAndSerializeCollections } from './serialize-item-collections';

// The book-info payload (docs/specs/3-library/3.2-book-info.md).
export async function getLibraryItem(options: {
  prisma: PrismaService;
  ref: string;
  userId: string;
}) {
  const item = await options.prisma.libraryItem.findFirst({
    where: ownedLibraryItemWhere(options.userId, options.ref),
    include: {
      book: {
        include: {
          coverBlob: { select: { mimeType: true } },
          // files.readingProgressIndex is a multi-KB JSON we never render
          // here — see the note in collections/get-collection.ts.
          files: {
            select: { format: true, isPrimary: true, kind: true },
          },
        },
      },
      collectionItems: {
        include: {
          collection: {
            select: {
              id: true,
              kind: true,
              name: true,
              smartKey: true,
              sortOrder: true,
            },
          },
        },
      },
      progress: true,
    },
  });

  if (!item) {
    throw new NotFoundException('Book not found in library.');
  }

  const primarySource = findPrimarySourceFile(item.book.files);

  return {
    book: {
      addedAt: item.addedAt.toISOString(),
      approximateBodyPageCount: item.book.estimatedBodyPageCount ?? null,
      approximatePageCount: item.book.estimatedPageCount ?? null,
      authors: item.book.authors,
      chapterLabel: item.progress?.chapterLabel ?? null,
      collections: sortAndSerializeCollections(item.collectionItems),
      completionPercent: item.progress?.completionPercent ?? 0,
      coverImageUrl: item.book.coverBlob
        ? buildCoverImageUrl(item.book.id)
        : null,
      description: item.book.description,
      finishedAt: item.finishedAt?.toISOString() ?? null,
      genres: item.book.genres,
      language: item.book.language,
      lastReadAt: item.progress?.lastReadAt?.toISOString() ?? null,
      libraryItemId: item.id,
      minutesRead: item.progress?.minutesRead ?? 0,
      offlineRequested: item.offlineRequested,
      primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
      publishedYear: item.book.publishedYear,
      slug: item.slug,
      source: item.source,
      title: item.book.title,
    },
  };
}
