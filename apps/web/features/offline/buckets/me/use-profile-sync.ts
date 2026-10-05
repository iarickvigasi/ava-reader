"use client";

import { useCallback } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useSyncTriggers } from "../../net/use-sync-triggers";
import { flushProfile } from "./sync";

export function useProfileSync() {
  const { getToken, isLoaded, isSignedIn } = useOfflineAuth();
  const flush = useCallback(() => {
    void flushProfile(getToken);
  }, [getToken]);
  useSyncTriggers(isLoaded && isSignedIn ? flush : null, {
    kickOnAttach: true,
  });
  return flush;
}
