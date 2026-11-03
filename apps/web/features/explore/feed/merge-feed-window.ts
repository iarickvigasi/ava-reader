import { LoadedCatalogPage } from "./types";

import { trimFeedWindow } from "./trim-feed-window";

export function mergeFeedWindow(
  pages: LoadedCatalogPage[],
  incoming: LoadedCatalogPage,
  protectedIds: readonly string[],
) {
  const index = pages.findIndex(
    (page) =>
      page.cursor === incoming.cursor && page.before === incoming.before,
  );
  const result = [...pages];
  if (!incoming.page.items.length && pages.length) {
    const edge = incoming.before ? 0 : result.length - 1;
    result[edge] = {
      ...result[edge],
      page: {
        ...result[edge].page,
        ...(incoming.before ? { previousCursor: null } : { nextCursor: null }),
      },
    };
    return result;
  }
  if (
    index >= 0 &&
    (pages[index].page.nextCursor !== incoming.page.nextCursor ||
      pages[index].page.previousCursor !== incoming.page.previousCursor)
  )
    return [incoming];
  if (index >= 0) result[index] = incoming;
  else if (incoming.before) result.unshift(incoming);
  else result.push(incoming);
  return trimFeedWindow(result, !!incoming.before, protectedIds);
}
