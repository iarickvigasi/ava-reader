"use client";

import { useCallback } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { fetchReaderPayloadFromNetwork } from "@/components/app/reader/data/reader-payload-network";
import { getActiveUserId } from "../../../db";
import { useSyncTriggers } from "../../../net/use-sync-triggers";
import { useNetworkState } from "../../../net/use-network-state";
import { refreshDownloadedChapterLabels } from "./refresh-labels";

export function DownloadedChapterLabelMigration() {
  const { getToken, isLoaded, isSignedIn, userId } = useOfflineAuth();
  const online = useNetworkState();
  const refresh = useCallback(() => {
    if (!online || !userId) return;
    void refreshDownloadedChapterLabels({
      userId,
      fetchReader: (libraryItemId) =>
        fetchReaderPayloadFromNetwork({
          libraryItemId,
          isLoaded,
          isSignedIn,
          signal: AbortSignal.timeout(15_000),
          getToken: async () => {
            const token = await getToken();
            return getActiveUserId() === userId ? token : null;
          },
        }),
    }).catch(() => undefined);
  }, [online, userId, isLoaded, isSignedIn, getToken]);
  useSyncTriggers(isLoaded && isSignedIn ? refresh : null, {
    kickOnAttach: true,
  });
  return null;
}
