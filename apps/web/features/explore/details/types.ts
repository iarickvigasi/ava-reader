import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
import type { LoadedCatalogPage } from "../feed/types";
export type ReadingDetails = {
  description: string | null;
  approximatePageCount: number | null;
  approximateBodyPageCount: number | null;
};

export type AuthorWorksLoaded = {
  id: string | null;
  pages: LoadedCatalogPage[];
  latest: CatalogPage<CatalogWork>;
  cursor: string | null;
};
