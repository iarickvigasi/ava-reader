"use client";

import type { GridRestorer } from "./restore-virtual-grid";
import { useEffect, useState } from "react";
import { useCatalogFeed } from "./use-catalog-feed";
import { useCatalogResource } from "./use-catalog-resource";
import { useExploreQuery } from "./use-explore-query";

export function useExplore(
  size: { first: number; next: number } | null,
  protectedIds: readonly string[] = [],
  restoreRef?: GridRestorer,
) {
  const state = useExploreQuery();
  const [query, setQuery] = useState(state.query);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(state.query), 300);
    return () => clearTimeout(timer);
  }, [state.query]);
  const params = new URLSearchParams({
    query,
    languages: state.languages.join(","),
    filters: state.filters.join(","),
  });
  const results = useCatalogFeed(
    params.toString(),
    size,
    protectedIds,
    restoreRef,
  );
  const facets = useCatalogResource<{ languages: string[] }>("works/filters");
  return {
    ...state,
    ...results,
    languagesAvailable: facets.data?.languages ?? [],
    languagesReady: !!facets.data,
    facetsError: facets.error,
    retryFacets: facets.retry,
    retry: () => {
      results.retry();
      facets.retry();
    },
    searching: state.query !== query,
  };
}
