// Groups membership links by collection id — the shape both the read path and
// the list write path need before they can act one collection at a time.

import type { CollectionMembershipRow } from "../../db";

export function groupMembershipByCollection(
  links: CollectionMembershipRow[],
): Map<string, CollectionMembershipRow[]> {
  const byCollection = new Map<string, CollectionMembershipRow[]>();
  for (const link of links) {
    const list = byCollection.get(link.collectionId);
    if (list) {
      list.push(link);
    } else {
      byCollection.set(link.collectionId, [link]);
    }
  }
  return byCollection;
}
