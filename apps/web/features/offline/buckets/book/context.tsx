"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useBookSaveStatus, useSaveBook } from "./hooks";
import { useEvictStaleAutoSaves } from "./use-evict-stale-auto-saves";
import { useAutoBookSave } from "./use-auto-book-save";
import { useBookCacheStatus } from "./use-book-cache-status";
import { deriveStatus, type BookContextStatus } from "./book-context-status";

export { deriveStatus } from "./book-context-status";
export type { BookContextStatus } from "./book-context-status";

type BookContextValue = {
  libraryItemId: string;
  status: BookContextStatus;
  currentChapters: number;
  totalChapters: number;
};
const Ctx = createContext<BookContextValue | null>(null);

export function useBookContext(): BookContextValue {
  return (
    useContext(Ctx) ?? {
      libraryItemId: "",
      status: "ready",
      currentChapters: 0,
      totalChapters: 0,
    }
  );
}

// Reader-page integration; chapter data still uses the existing cache-first path.
export function BookContextProvider({
  libraryItemId,
  children,
}: {
  libraryItemId: string;
  children: ReactNode;
}) {
  const { userId: ownerId } = useOfflineAuth();
  const online = useNetworkState();
  const saveSnapshot = useBookSaveStatus(libraryItemId);
  const { save } = useSaveBook(libraryItemId);
  const cache = useBookCacheStatus(libraryItemId, ownerId, saveSnapshot.status);
  useAutoBookSave({
    libraryItemId,
    ownerId,
    hasCached: cache?.complete ?? null,
    online,
    saveStatus: saveSnapshot.status,
    save,
  });
  useEvictStaleAutoSaves(libraryItemId, online && cache?.complete === true);
  const status = deriveStatus({
    hasCached: cache?.readable ?? null,
    online,
    saveStatus: saveSnapshot.status,
  });
  useEffect(() => {
    if (status === "missing-offline")
      emitMissingBookOfflineModal({ libraryItemId });
  }, [status, libraryItemId]);
  return (
    <Ctx.Provider
      value={{
        libraryItemId,
        status,
        currentChapters: saveSnapshot.currentChapters,
        totalChapters: saveSnapshot.totalChapters,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
