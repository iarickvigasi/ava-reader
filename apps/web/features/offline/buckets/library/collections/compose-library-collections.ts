import type {
  CollectionMembershipRow,
  CollectionRow,
  LibraryItemRow,
} from "../../../db";
import {
  composeCollectionCounts,
  type CompletionContext,
} from "../../../completion/counts";
import { overlayCollectionMembership } from "../membership/selectors";
import { buildCollectionView } from "./collection-view";
import { compareCollectionViews } from "./compare-collections";

export function composeLibraryCollections(
  collections: CollectionRow[],
  items: LibraryItemRow[],
  byCollection: Map<string, CollectionMembershipRow[]>,
  completion: CompletionContext,
) {
  const mutations = [...completion.memberships.values()];
  return collections
    .map((collection) => {
      const overlaid = overlayCollectionMembership(
        collection,
        items,
        byCollection.get(collection.id) ?? [],
        mutations,
      );
      const view = buildCollectionView(
        overlaid.collection,
        items,
        overlaid.links,
      );
      return collection.completionItems
        ? { ...view, ...composeCollectionCounts(collection, completion) }
        : view;
    })
    .sort(compareCollectionViews);
}
