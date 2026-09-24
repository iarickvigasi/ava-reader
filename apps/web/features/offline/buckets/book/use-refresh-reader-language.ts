"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect } from "react";

import { fetchReaderPayloadFromNetwork } from "@/components/app/reader/data/reader-payload-network";

import { getActiveUserId } from "../../db";
import { useNetworkState } from "../../net/use-network-state";
import { readKnownReaderLanguage } from "./reader-language";
import { refreshReaderLanguage } from "./refresh-reader-language";

export function useRefreshReaderLanguage(libraryItemId: string): void {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const online = useNetworkState();

  useEffect(() => {
    if (!online || !isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    // Let the root identity reconciler adopt this user before accessing Dexie.
    void Promise.resolve()
      .then(async () => {
        if (cancelled) return;
        await refreshReaderLanguage({
          libraryItemId,
          userId,
          fetchLanguage: async () => {
            const payload = await fetchReaderPayloadFromNetwork({
              libraryItemId,
              isLoaded,
              isSignedIn,
              getToken: async () => {
                const token = await getToken();
                return getActiveUserId() === userId ? token : null;
              },
            });
            return readKnownReaderLanguage(payload.book);
          },
        });
      })
      .catch(() => undefined);
    // Persistence deliberately does not update the active reader's language.
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, libraryItemId, online, userId]);
}
