import type { Prisma } from '@prisma/client';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../../shared/engagement-date';
import { serializeCollectionSummary } from '../serialize-collection-summary';
import { serializeLibraryBook } from '../serialize-library-book';

export type LibraryCollectionRecord = Prisma.CollectionGetPayload<{
  include: {
    items: {
      include: {
        libraryItem: {
          include: {
            book: {
              include: {
                coverBlob: { select: { mimeType: true } };
                files: {
                  select: { format: true; isPrimary: true; kind: true };
                };
              };
            };
            progress: true;
          };
        };
      };
    };
  };
}>;

// The collection page payload: the shared summary shape with every active
// book, engagement-sorted (docs/specs/3-library/3.5-library-payloads.md §2).
export function serializeCollection(collection: LibraryCollectionRecord) {
  const activeItems = collection.items
    .map((item) => item.libraryItem)
    .filter((item) => !item.isArchived)
    .sort(compareByEngagementDesc);
  const books = activeItems.map((item) =>
    serializeLibraryBook(item, {
      completionPercent: item.progress?.completionPercent ?? 0,
      lastReadAt: mostRecentEngagementDate(item),
    }),
  );

  return serializeCollectionSummary({ activeItems, books, collection });
}
