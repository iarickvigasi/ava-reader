import type { CollectionKind } from '@prisma/client';
import {
  compareCollectionsForDisplay,
  type CollectionOrderKey,
} from '../shared/compare-collections';
import { mostRecentEngagementDate } from '../shared/engagement-date';

const HOME_COLLECTION_LIMIT = 6;
const FULLY_READ_PERCENT = 100;

type PanelItem = {
  libraryItem: {
    addedAt: Date;
    lastOpenedAt: Date | null;
    progress: { completionPercent: number; lastReadAt: Date | null } | null;
  };
};

type PanelCollection = {
  description: string | null;
  id: string;
  items: PanelItem[];
  kind: CollectionKind;
  name: string;
  slug: string;
  smartKey: string | null;
};

// The home collections panel (docs/specs/1-home-dashboard.md §4): the first six
// collections in the library's display order. The cut has to happen after the
// sort, so the query hands us every collection rather than taking six itself.
export function selectHomeCollections(collections: PanelCollection[]) {
  return [...collections]
    .sort((left, right) =>
      compareCollectionsForDisplay(toOrderKey(left), toOrderKey(right)),
    )
    .slice(0, HOME_COLLECTION_LIMIT)
    .map(serializePanelCollection);
}

function toOrderKey(collection: PanelCollection): CollectionOrderKey {
  return {
    itemCount: collection.items.length,
    lastEngagementAt: latestEngagement(collection.items),
    name: collection.name,
  };
}

// Home's items arrive unsorted, so the collection's recency is a scan rather
// than the first entry the library overview can rely on.
function latestEngagement(items: PanelItem[]): Date | null {
  let latest: Date | null = null;
  for (const { libraryItem } of items) {
    const engaged = mostRecentEngagementDate(libraryItem);
    if (!latest || engaged > latest) {
      latest = engaged;
    }
  }
  return latest;
}

function serializePanelCollection(collection: PanelCollection) {
  return {
    description: collection.description,
    id: collection.id,
    itemCount: collection.items.length,
    kind: collection.kind,
    name: collection.name,
    slug: collection.slug,
    smartKey: collection.smartKey,
    unreadCount: collection.items.filter(
      (item) =>
        (item.libraryItem.progress?.completionPercent ?? 0) <
        FULLY_READ_PERCENT,
    ).length,
  };
}
