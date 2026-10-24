import type { LoadedCatalogPage } from "./merge-catalog-pages";

export const FEED_PAGE_LIMIT = 5;

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

export function trimFeedWindow(
  pages: LoadedCatalogPage[],
  backward: boolean,
  protectedIds: readonly string[],
) {
  const result = [...pages];
  while (result.length > FEED_PAGE_LIMIT) {
    const edge = backward ? result.length - 1 : 0;
    if (result[edge].page.items.some((work) => protectedIds.includes(work.id)))
      break;
    result.splice(edge, 1);
  }
  return result;
}
