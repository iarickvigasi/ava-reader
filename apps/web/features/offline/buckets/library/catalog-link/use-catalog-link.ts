"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useNetworkState } from "../../../net/use-network-state";
import { currentLinkRuntime, hydrateLinks, linkRuntime } from "./bucket";
import { EMPTY_LINK, selectedCatalogLink } from "./selectors";
import { refreshCatalogLink } from "./refresh";
import { flushCatalogLinks } from "./sync";
import { setCatalogLink } from "./mutations";
import type { CatalogLink } from "./types";
export function useCatalogLink(id: string) {
  const { getToken } = useOfflineAuth();
  const online = useNetworkState();
  const runtime = linkRuntime(getToken);
  const state = useSyncExternalStore(
    (listener) => {
      runtime.listeners.add(listener);
      return () => runtime.listeners.delete(listener);
    },
    () => runtime.records.get(id) ?? EMPTY_LINK,
    () => EMPTY_LINK,
  );
  useEffect(() => {
    void hydrateLinks(runtime).then(() => {
      if (online && currentLinkRuntime(runtime)) {
        void refreshCatalogLink(runtime, id).catch(() => {});
        void flushCatalogLinks(getToken);
      }
    });
  }, [runtime, id, online, getToken]);
  return {
    link: selectedCatalogLink(state),
    pending: !!state.pending,
    error: state.error,
    save: (link: CatalogLink | null) => setCatalogLink(id, link, getToken),
  };
}
