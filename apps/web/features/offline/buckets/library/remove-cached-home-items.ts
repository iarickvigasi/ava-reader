import type { AvaReaderDB } from "../../db";

export async function removeCachedHomeItems(
  db: AvaReaderDB,
  removed: Set<string>,
  highlightIds: Set<string>,
) {
  const home = await db.home.get("me");
  if (home)
    await db.home.put({
      ...home,
      payload: {
        ...home.payload,
        currentEngagement:
          home.payload.currentEngagement &&
          removed.has(home.payload.currentEngagement.libraryItemId)
            ? null
            : home.payload.currentEngagement,
        completionItems: home.payload.completionItems?.filter(
          (item) => !removed.has(item.libraryItemId),
        ),
        recentAnnotations: {
          items: home.payload.recentAnnotations.items.filter(
            (item) => !highlightIds.has(item.id),
          ),
        },
        collections: {
          items: home.payload.collections.items.map((collection) => ({
            ...collection,
            completionItems: collection.completionItems?.filter(
              (item) => !removed.has(item.libraryItemId),
            ),
          })),
        },
      },
    });
}
