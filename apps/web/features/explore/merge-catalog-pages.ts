import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";

export type LoadedCatalogPage = {
  cursor: string | null;
  before?: string;
  page: CatalogPage<CatalogWork>;
};

export function mergeCatalogPages(
  pages: LoadedCatalogPage[],
  incoming: LoadedCatalogPage,
) {
  const index = pages.findIndex((item) => item.cursor === incoming.cursor);
  return index < 0
    ? [...pages, incoming]
    : pages.map((item, position) => (position === index ? incoming : item));
}

export function uniqueCatalogWorks(pages: LoadedCatalogPage[]) {
  return [
    ...new Map(
      pages.flatMap(({ page }) => page.items).map((work) => [work.id, work]),
    ).values(),
  ];
}
