"use client";
import type { CatalogAuthor } from "@/lib/catalog-types";
import { useCatalogLocation } from "../navigation/use-catalog-location";
import { useCatalogResource } from "../data/use-catalog-resource";
import { useAuthorWorks } from "./use-author-works";
export function useCatalogAuthor() {
  const id = useCatalogLocation("authors");
  const author = useCatalogResource<CatalogAuthor>(id ? `authors/${id}` : null);
  const works = useAuthorWorks(id);
  return { author, ...works };
}
