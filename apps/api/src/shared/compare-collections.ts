// Display order for collection lists — the library overview and the home panel
// (docs/specs/7-library/7.1-library-screen.md §3).
//
// Recency leads, but ties are the norm rather than the exception: a broad shelf
// re-lists a narrow shelf's books, so opening one book gives every collection
// holding it the same recency. The item count is what separates them, floating
// the more specific collection up. Collections with nothing in them sink.

export type CollectionOrderKey = {
  itemCount: number;
  // The collection's most recent engagement date (the max over its items);
  // null when it holds none.
  lastEngagementAt: Date | null;
  name: string;
};

export function compareCollectionsForDisplay(
  left: CollectionOrderKey,
  right: CollectionOrderKey,
): number {
  return (
    compareEmptyLast(left, right) ||
    compareRecencyDesc(left, right) ||
    compareFewestItemsFirst(left, right) ||
    left.name.localeCompare(right.name)
  );
}

function compareEmptyLast(
  left: CollectionOrderKey,
  right: CollectionOrderKey,
): number {
  return Number(left.itemCount === 0) - Number(right.itemCount === 0);
}

function compareRecencyDesc(
  left: CollectionOrderKey,
  right: CollectionOrderKey,
): number {
  return engagementMs(right) - engagementMs(left);
}

function compareFewestItemsFirst(
  left: CollectionOrderKey,
  right: CollectionOrderKey,
): number {
  return left.itemCount - right.itemCount;
}

function engagementMs(key: CollectionOrderKey): number {
  return key.lastEngagementAt?.getTime() ?? 0;
}
