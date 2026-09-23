import type { Prisma } from '@prisma/client';

import { SOURCE_SMART_KEYS } from '../../shared/default-collections';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../../shared/engagement-date';
import { serializeCollectionSummary } from '../serialize-collection-summary';
import { serializeLibraryBook } from '../serialize-library-book';
import { loadCollectionOverviews } from './load-collection-overviews';
import { loadPreviewItems } from './load-preview-items';
import { orderCollectionsForDisplay } from './order-collections';

const LIBRARY_COLLECTION_PREVIEW_LIMIT = 4;

// GET /library (docs/specs/3-library/3.5-library-payloads.md §1): the
// two-phase read behind the library screen.
export async function getLibraryOverview(options: {
  prisma: Prisma.TransactionClient;
  userId: string;
}) {
  const collections = await loadCollectionOverviews(
    options.prisma,
    options.userId,
  );

  const perCollection = orderCollectionsForDisplay(
    collections.map((collection) => {
      const activeItems = collection.items
        .map((item) => item.libraryItem)
        .filter((item) => !item.isArchived)
        .sort(compareByEngagementDesc);
      const previewIds = activeItems
        .slice(0, LIBRARY_COLLECTION_PREVIEW_LIMIT)
        .map((item) => item.id);
      return { activeItems, collection, previewIds };
    }),
  );

  const previewIds = Array.from(
    new Set(perCollection.flatMap(({ previewIds }) => previewIds)),
  );
  const previewItems = await loadPreviewItems(options.prisma, previewIds);
  const previewById = new Map(previewItems.map((item) => [item.id, item]));

  const identities = await options.prisma.libraryItem.findMany({
    where: { userId: options.userId },
    select: { id: true },
  });
  return {
    libraryItemIds: identities.map((item) => item.id),
    collections: perCollection.map(
      ({ activeItems, collection, previewIds }) => {
        const books = previewIds
          .map((id) => {
            const item = previewById.get(id);
            const lite = activeItems.find((candidate) => candidate.id === id);
            if (!item || !lite) {
              return null;
            }
            return serializeLibraryBook(item, {
              completionPercent: lite.progress?.completionPercent ?? 0,
              lastReadAt: mostRecentEngagementDate(lite),
            });
          })
          .filter((book): book is NonNullable<typeof book> => book !== null);

        return serializeCollectionSummary({ activeItems, books, collection });
      },
    ),
    summary: {
      booksCount: countUniqueBooks(perCollection),
      collectionsCount: collections.length,
    },
  };
}

// The library-wide book total, read from the source shelves alone: together
// they hold every book exactly once, while Offline Books and custom lists
// re-list those same books. A shelf the user doesn't have yet is skipped, and
// the Set keeps a book counted once even if the shelves ever overlap.
function countUniqueBooks(
  perCollection: Array<{
    activeItems: Array<{ id: string }>;
    collection: { smartKey: string | null };
  }>,
): number {
  const bookIds = new Set<string>();
  for (const { activeItems, collection } of perCollection) {
    if (!isSourceShelf(collection.smartKey)) {
      continue;
    }
    for (const item of activeItems) {
      bookIds.add(item.id);
    }
  }
  return bookIds.size;
}

function isSourceShelf(smartKey: string | null): boolean {
  return smartKey !== null && SOURCE_SMART_KEYS.includes(smartKey);
}
