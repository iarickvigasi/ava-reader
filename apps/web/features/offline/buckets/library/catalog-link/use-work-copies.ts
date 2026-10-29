"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useLibraryView } from "../hooks";
import { refreshFromDb } from "../bucket";
import { revalidateLibrary } from "../revalidate";
import { useNetworkState } from "../../../net/use-network-state";
import { currentLinkRuntime, hydrateLinks, linkRuntime } from "./bucket";
import { refreshWorkLinks } from "./refresh-work";
import { selectedCatalogLink } from "./selectors";
export function useWorkCopies(workId: string) {
  const { getToken } = useOfflineAuth();
  const online = useNetworkState();
  const runtime = linkRuntime(getToken);
  const library = useLibraryView();
  useSyncExternalStore(
    (listener) => {
      runtime.listeners.add(listener);
      return () => runtime.listeners.delete(listener);
    },
    () => runtime.version,
    () => 0,
  );
  useEffect(() => {
    void refreshFromDb();
    void hydrateLinks(runtime).then(() => {
      if (online && currentLinkRuntime(runtime)) {
        void refreshWorkLinks(runtime, workId).catch(() => {});
        void revalidateLibrary(getToken).catch(() => {});
      }
    });
  }, [runtime, workId, online, getToken]);
  return (
    library?.books.filter(
      (book) =>
        book.source === "IMPORTED" &&
        selectedCatalogLink(
          runtime.records.get(book.libraryItemId) ?? {
            snapshot: null,
            pending: null,
            error: "",
          },
        )?.workId === workId,
    ) ?? []
  );
}
