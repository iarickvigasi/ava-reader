"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { readCatalogCache, writeCatalogCache } from "./catalog-cache";
import { getDb } from "@/features/offline/db";
import { getPublicApiBaseUrl } from "@/lib/api";
export type ReadingDetails = {
  description: string | null;
  approximatePageCount: number | null;
  approximateBodyPageCount: number | null;
};
export function useReadingDetails(editionId: string | undefined) {
  const { getToken } = useOfflineAuth();
  const online = useNetworkState();
  const [state, setState] = useState<{
    id: string;
    value: ReadingDetails;
  } | null>(null);
  useEffect(() => {
    if (!editionId) return;
    const controller = new AbortController();
    void (async () => {
      const db = getDb();
      const key = `reading-details/${editionId}`;
      const cached = await readCatalogCache<ReadingDetails>(key);
      if (controller.signal.aborted || db !== getDb()) return;
      if (cached) setState({ id: editionId, value: cached });
      const token = await getToken();
      if (!token || !online || controller.signal.aborted) return;
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/catalog/editions/${editionId}/reading-details`,
        {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) return;
      const value = (await response.json()) as ReadingDetails;
      if (controller.signal.aborted || db !== getDb()) return;
      setState({ id: editionId, value });
      await writeCatalogCache(key, value);
    })().catch(() => undefined);
    return () => controller.abort();
  }, [editionId, getToken, online]);
  return state && state.id === editionId ? state.value : null;
}
