import type { Prisma } from '@prisma/client';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../../shared/engagement-date';
import { serializeCollectionSummary } from '../serialize-collection-summary';
import { serializeLibraryBook } from '../serialize-library-book';
import { loadCollectionOverviews } from './load-collection-overviews';
import { loadLibraryItems } from './load-library-items';
import { loadPreviewItems } from './load-preview-items';
import { orderCollectionsForDisplay } from './order-collections';

const LIBRARY_COLLECTION_PREVIEW_LIMIT = 4;

export async function getLibraryOverview(options: {
  prisma: Prisma.TransactionClient;
  userId: string;
}) {
  const identities = await loadLibraryItems(options.prisma, options.userId);
  const activeItems = identities
    .filter((item) => !item.isArchived)
    .sort(compareByEngagementDesc);
  const records = await loadPreviewItems(
    options.prisma,
    activeItems.map((item) => item.id),
  );
  const recordsById = new Map(records.map((item) => [item.id, item]));
  const books = activeItems.flatMap((item) => {
    const record = recordsById.get(item.id);
    return record
      ? [
          serializeLibraryBook(record, {
            completionPercent: item.progress?.completionPercent ?? 0,
            lastReadAt: mostRecentEngagementDate(item),
          }),
        ]
      : [];
  });
  const booksById = new Map(books.map((book) => [book.libraryItemId, book]));
  const collections = await loadCollectionOverviews(
    options.prisma,
    options.userId,
  );
  const ordered = orderCollectionsForDisplay(
    collections.map((collection) => {
      const members = collection.items
        .map((item) => item.libraryItem)
        .filter((item) => !item.isArchived)
        .sort(compareByEngagementDesc);
      return { activeItems: members, collection };
    }),
  );
  return {
    libraryItemIds: identities.map((item) => item.id),
    books,
    collections: ordered.map(({ activeItems: members, collection }) =>
      serializeCollectionSummary({
        activeItems: members,
        collection,
        books: members
          .slice(0, LIBRARY_COLLECTION_PREVIEW_LIMIT)
          .flatMap((item) => booksById.get(item.id) ?? []),
      }),
    ),
    summary: {
      booksCount: activeItems.length,
      collectionsCount: collections.length,
    },
  };
}
