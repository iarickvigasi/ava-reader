"use client";

import type {
  CatalogEdition,
  CatalogPage,
  CatalogWork,
} from "@/lib/catalog-types";
import { useCatalogLocation } from "./use-catalog-location";
import { useCatalogResource } from "./use-catalog-resource";

export function useCatalogBook() {
  const id = useCatalogLocation("books");
  const work = useCatalogResource<CatalogWork>(id ? `works/${id}` : null);
  const editions = useCatalogResource<CatalogPage<CatalogEdition>>(
    id ? `works/${id}/editions` : null,
  );
  const items = editions.data?.items ?? [];
  const readableId = work.data?.readingAssets?.[0]?.edition.id;
  return {
    work,
    editions,
    selectedEdition:
      items.find((item) => item.id === readableId) ??
      work.data?.readingAssets?.[0]?.edition ??
      items.at(0),
  };
}
