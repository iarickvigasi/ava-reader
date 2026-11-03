import { BookFileFormat } from '@prisma/client';
import { hasReadableEdition } from '../has-readable-edition';
import { buildCoverImageUrl } from '../../shared/cover-image-url';
import { findPrimarySourceFile } from '../../shared/primary-book-file';
import type { loadBookInfoItem } from './load-book-info-item';
import type { loadBookReadingSnapshot } from './load-book-reading-snapshot';
import { sortAndSerializeCollections } from './serialize-item-collections';

export function serializeBookInfo(
  item: Awaited<ReturnType<typeof loadBookInfoItem>>,
  readingSnapshot: Awaited<ReturnType<typeof loadBookReadingSnapshot>>,
) {
  const primarySource = findPrimarySourceFile(item.book.files);
  return {
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
    minutesRead: Math.floor(readingSnapshot.totalSeconds / 60),
    readingSnapshot,
    offlineRequested: item.offlineRequested,
    primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
    publishedYear: item.book.publishedYear,
    slug: item.slug,
    source: item.source,
    hasReadableEdition: hasReadableEdition(item.book.files),
    title: item.book.title,
  };
}
