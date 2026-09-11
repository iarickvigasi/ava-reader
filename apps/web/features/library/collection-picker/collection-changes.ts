import type { LibraryBookInfo } from "@/lib/api-types";

export function collectionChanges(
  collections: LibraryBookInfo["collections"],
  initialIds: ReadonlySet<string>,
  selectedIds: ReadonlySet<string>,
) {
  const editable = collections.filter((collection) => collection.kind === "CUSTOM");
  return {
    addCollectionIds: editable
      .filter(({ id }) => selectedIds.has(id) && !initialIds.has(id))
      .map(({ id }) => id),
    removeCollectionIds: editable
      .filter(({ id }) => initialIds.has(id) && !selectedIds.has(id))
      .map(({ id }) => id),
  };
}
