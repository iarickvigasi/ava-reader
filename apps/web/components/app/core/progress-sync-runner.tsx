"use client";

// Drains locally-dirty reading progress up to the server on the usual offline-
// sync triggers (online event, tab regains visibility, mount). Mounted in
// AppShell so it runs on every authenticated route, independent of the reader —
// this is what lets offline reading sync without reopening the book (see
// specs/6-reading-sessions-progress). The flush is single-flight and online-
// guarded, so firing it from several triggers is cheap.

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

import { flushDirtyProgress } from "@/features/offline/buckets/progress";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";

export function ProgressSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const tryFlush = useCallback(() => {
    void flushDirtyProgress(getToken);
  }, [getToken]);

  // Kick once on mount so progress left dirty by a prior session (reader
  // closed while offline) syncs without waiting for the next event.
  useSyncTriggers(isLoaded && isSignedIn ? tryFlush : null, {
    kickOnAttach: true,
  });

  return null;
}
