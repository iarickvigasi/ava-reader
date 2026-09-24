"use client";

import { useCallback, useEffect } from "react";
import { useOfflineAuth } from "./use-offline-auth";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";
import { resumePendingWork } from "@/features/offline/resume-pending-work";

export function AccountSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useOfflineAuth();
  const ready = isLoaded && isSignedIn;
  const sync = useCallback(() => {
    if (navigator.onLine && document.visibilityState === "visible")
      void resumePendingWork(getToken).catch(() => undefined);
  }, [getToken]);
  useSyncTriggers(ready ? sync : null, { kickOnAttach: true });
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(sync, 30_000);
    return () => clearInterval(timer);
  }, [ready, sync]);
  return null;
}
