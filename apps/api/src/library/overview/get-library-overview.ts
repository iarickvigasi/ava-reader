import type { PrismaService } from '../../prisma/prisma.service';
import {
  compareByEngagementDesc,
  mostRecentEngagementDate,
} from '../../shared/engagement-date';
import { serializeCollectionSummary } from '../serialize-collection-summary';
import { serializeLibraryBook } from '../serialize-library-book';
import { loadCollectionOverviews } from './load-collection-overviews';
import { loadPreviewItems } from './load-preview-items';

const LIBRARY_COLLECTION_PREVIEW_LIMIT = 4;

// GET /library (docs/specs/7-library/7.5-library-payloads.md §1): the
// two-phase read behind the library screen.
export async function getLibraryOverview(options: {
  prisma: PrismaService;
  userId: string;
}) {
  const collections = await loadCollectionOverviews(
    options.prisma,
    options.userId,
  );

  const perCollection = collections.map((collection) => {
    const activeItems = collection.items
      .map((item) => item.libraryItem)
      .filter((item) => !item.isArchived)
      .sort(compareByEngagementDesc);
    const previewIds = activeItems
      .slice(0, LIBRARY_COLLECTION_PREVIEW_LIMIT)
      .map((item) => item.id);
    return { activeItems, collection, previewIds };
  });

  const previewIds = Array.from(
    new Set(perCollection.flatMap(({ previewIds }) => previewIds)),
  );
  const previewItems = await loadPreviewItems(options.prisma, previewIds);
  const previewById = new Map(previewItems.map((item) => [item.id, item]));

  return {
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
      booksCount: perCollection.reduce(
        (sum, { activeItems }) => sum + activeItems.length,
        0,
      ),
      collectionsCount: collections.length,
    },
  };
}
