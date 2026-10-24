"use client";

import { useState } from "react";
import { useCursorPages } from "./use-cursor-pages";
import type {
  CatalogAuthor,
  CatalogPage,
  CatalogWork,
} from "@/lib/catalog-types";
import { useCatalogLocation } from "./use-catalog-location";
import { useCatalogResource } from "./use-catalog-resource";
import {
  mergeCatalogPages,
  uniqueCatalogWorks,
  type LoadedCatalogPage,
} from "./merge-catalog-pages";

export function useCatalogAuthor() {
  const id = useCatalogLocation("authors");
  const pages = useCursorPages(id);
  const cursor = pages.cursor ?? null;
  const author = useCatalogResource<CatalogAuthor>(id ? `authors/${id}` : null);
  const works = useCatalogResource<CatalogPage<CatalogWork>>(
    id
      ? `authors/${id}/works${pages.cursor ? `?cursor=${pages.cursor}` : ""}`
      : null,
  );
  const [loaded, setLoaded] = useState<{
    id: string | null;
    pages: LoadedCatalogPage[];
    latest: CatalogPage<CatalogWork>;
    cursor: string | null;
  } | null>(null);
  if (
    works.data &&
    (loaded?.id !== id ||
      loaded.latest !== works.data ||
      loaded.cursor !== cursor)
  ) {
    setLoaded({
      id,
      latest: works.data,
      cursor,
      pages: mergeCatalogPages(loaded?.id === id ? loaded.pages : [], {
        cursor,
        page: works.data,
      }),
    });
  }
  return {
    author,
    works,
    items: uniqueCatalogWorks(loaded?.id === id ? loaded.pages : []),
    next: () => pages.next(works.data?.nextCursor),
  };
}
