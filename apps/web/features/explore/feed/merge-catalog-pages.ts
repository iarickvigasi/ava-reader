import type { LoadedCatalogPage } from "./types";
export function mergeCatalogPages(
  pages: LoadedCatalogPage[],
  incoming: LoadedCatalogPage,
) {
  const index = pages.findIndex((item) => item.cursor === incoming.cursor);
  return index < 0
    ? [...pages, incoming]
    : pages.map((item, position) => (position === index ? incoming : item));
}
