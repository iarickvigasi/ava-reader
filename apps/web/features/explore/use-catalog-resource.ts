"use client";

import { useEffect, useState } from "react";
import { fetchCatalog } from "@/lib/catalog-api";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { readCatalogCache, writeCatalogCache } from "./catalog-cache";

type Resource<T> = {
  path: string;
  data: T | null;
  error: boolean;
  stale: boolean;
};

export function useCatalogResource<T>(path: string | null) {
  const [state, setState] = useState<Resource<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const online = useNetworkState();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let cached: T | null = null;
    void (async () => {
      cached = await readCatalogCache<T>(path);
      if (controller.signal.aborted) return;
      if (cached) setState({ path, data: cached, error: false, stale: true });
      try {
        const data = await fetchCatalog<T>(path, controller.signal);
        if (controller.signal.aborted) return;
        setState({ path, data, error: false, stale: false });
        void writeCatalogCache(path, data);
      } catch {
        if (!controller.signal.aborted)
          setState({ path, data: cached, error: true, stale: !!cached });
      }
    })();
    return () => controller.abort();
  }, [path, attempt, online]);
  const current = state?.path === path ? state : null;
  return {
    data: current?.data ?? null,
    loading: !current,
    error: current?.error ?? false,
    stale: current?.stale ?? false,
    retry: () => setAttempt((value) => value + 1),
  };
}
