"use client";

import { useState } from "react";
import { useCursorPages } from "./use-cursor-pages";
import type {
  CatalogEdition,
  CatalogPage,
  CatalogWork,
} from "@/lib/catalog-types";
import { useCatalogLocation } from "./use-catalog-location";
import { useCatalogResource } from "./use-catalog-resource";

export function useCatalogBook() {
  const id = useCatalogLocation("books");
  const pages = useCursorPages(id);
  const cursor = pages.cursor;
  const work = useCatalogResource<CatalogWork>(id ? `works/${id}` : null);
  const editions = useCatalogResource<CatalogPage<CatalogEdition>>(
    id ? `works/${id}/editions${cursor ? `?cursor=${cursor}` : ""}` : null,
  );
  const [loaded, setLoaded] = useState<{
    id: string | null;
    items: CatalogEdition[];
    latest: CatalogPage<CatalogEdition> | null;
  }>({ id, items: [], latest: null });
  if (loaded.id !== id) setLoaded({ id, items: [], latest: null });
  if (editions.data && loaded.id === id && loaded.latest !== editions.data) {
    const unique = new Map(loaded.items.map((item) => [item.id, item]));
    editions.data.items.forEach((item) => unique.set(item.id, item));
    setLoaded({ id, items: [...unique.values()], latest: editions.data });
  }
  const items = loaded.id === id ? loaded.items : [];
  const readableId = work.data?.readingAssets?.[0]?.edition.id;
  return {
    work,
    editions,
    items,
    selectedEdition:
      items.find((item) => item.id === readableId) ??
      work.data?.readingAssets?.[0]?.edition ??
      items.at(0),
    next: () => pages.next(editions.data?.nextCursor),
  };
}
