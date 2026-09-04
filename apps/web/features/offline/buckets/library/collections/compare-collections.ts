// Display order for the cached library view — the mirror of the server's
// apps/api/src/shared/compare-collections.ts (this workspace has no shared
// package; lib/smart-collections.ts mirrors an API constant the same way).
// See docs/specs/3-library/3.1-library-screen.md §3.
//
// Applied on read rather than stored: Dexie hands `collections` back in
// primary-key order, and the Offline Books shelf is derived locally, so its
// position has to be recomputed from whatever is cached right now.

import type { CollectionView } from "../types";

type CollectionOrderKey = {
  itemCount: number;
  lastEngagementMs: number;
  name: string;
};

export function compareCollectionViews(
  left: CollectionView,
  right: CollectionView,
): number {
  return compareOrderKeys(toOrderKey(left), toOrderKey(right));
}

function compareOrderKeys(
  left: CollectionOrderKey,
  right: CollectionOrderKey,
): number {
  return (
    Number(left.itemCount === 0) - Number(right.itemCount === 0) ||
    right.lastEngagementMs - left.lastEngagementMs ||
    left.itemCount - right.itemCount ||
    left.name.localeCompare(right.name)
  );
}

function toOrderKey(collection: CollectionView): CollectionOrderKey {
  return {
    itemCount: collection.itemCount,
    // Books arrive engagement-sorted — by the server's membership order for a
    // stored shelf, by selectOfflineBookRows for the derived one — so the
    // first is the collection's most recent.
    lastEngagementMs: engagementMs(collection.books[0]?.lastReadAt ?? null),
    name: collection.name,
  };
}

function engagementMs(lastReadAt: string | null): number {
  if (!lastReadAt) {
    return 0;
  }
  const parsed = Date.parse(lastReadAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}
