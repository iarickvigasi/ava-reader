"use client";

import { useState } from "react";
import { useCursorPages } from "../feed/use-cursor-pages";
import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
import { useCatalogResource } from "../data/use-catalog-resource";
import { mergeCatalogPages } from "../feed/merge-catalog-pages";
import type { AuthorWorksLoaded } from "./types";
import { uniqueCatalogWorks } from "../feed/unique-catalog-works";

export function useAuthorWorks(id: string | null) {
  const pages = useCursorPages(id);
  const cursor = pages.cursor ?? null;
  const works = useCatalogResource<CatalogPage<CatalogWork>>(
    id
      ? `authors/${id}/works${pages.cursor ? `?cursor=${pages.cursor}` : ""}`
      : null,
  );
  const [loaded, setLoaded] = useState<AuthorWorksLoaded | null>(null);
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
    works,
    items: uniqueCatalogWorks(loaded?.id === id ? loaded.pages : []),
    next: () => pages.next(works.data?.nextCursor),
  };
}
