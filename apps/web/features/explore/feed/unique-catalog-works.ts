import type { LoadedCatalogPage } from "./types";
export function uniqueCatalogWorks(pages: LoadedCatalogPage[]) {
  return [
    ...new Map(
      pages.flatMap(({ page }) => page.items).map((work) => [work.id, work]),
    ).values(),
  ];
}
