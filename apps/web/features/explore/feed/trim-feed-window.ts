import type { LoadedCatalogPage } from "./types";
import { FEED_PAGE_LIMIT } from "./constants";
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
