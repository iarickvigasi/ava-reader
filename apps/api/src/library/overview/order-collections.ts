import {
  compareCollectionsForDisplay,
  type CollectionOrderKey,
} from '../../shared/compare-collections';
import { mostRecentEngagementDate } from '../../shared/engagement-date';
import type { LibraryItemLite } from './load-collection-overviews';

type OverviewEntry = {
  activeItems: LibraryItemLite[];
  collection: { name: string };
};

// Puts the overview's collections in display order
// (docs/specs/7-library/7.1-library-screen.md §3). activeItems is already
// engagement-sorted by the caller, so its first entry carries the collection's
// recency — no second pass over the items.
export function orderCollectionsForDisplay<Entry extends OverviewEntry>(
  entries: Entry[],
): Entry[] {
  return [...entries].sort((left, right) =>
    compareCollectionsForDisplay(toOrderKey(left), toOrderKey(right)),
  );
}

function toOrderKey(entry: OverviewEntry): CollectionOrderKey {
  const mostRecent = entry.activeItems[0];
  return {
    itemCount: entry.activeItems.length,
    lastEngagementAt: mostRecent ? mostRecentEngagementDate(mostRecent) : null,
    name: entry.collection.name,
  };
}
