type CollectionItemForSerialize = {
  collection: {
    id: string;
    kind: 'SMART' | 'CUSTOM';
    name: string;
    smartKey: null | string;
    sortOrder: number;
  };
};

// The collections chips on book-info, sorted sortOrder then name
// (docs/specs/7-library/7.5-library-payloads.md §3).
export function sortAndSerializeCollections(
  collectionItems: CollectionItemForSerialize[],
) {
  return collectionItems
    .map((collectionItem) => collectionItem.collection)
    .sort((left, right) => {
      if (left.sortOrder === right.sortOrder) {
        return left.name.localeCompare(right.name);
      }
      return left.sortOrder - right.sortOrder;
    })
    .map((collection) => ({
      id: collection.id,
      kind: collection.kind,
      name: collection.name,
      smartKey: collection.smartKey,
    }));
}
