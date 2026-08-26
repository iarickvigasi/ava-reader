"use client";

// Drains any locally-dirty preference fields on the usual offline-sync
// triggers (online event, tab regains visibility). Mounted in AppShell so
// it runs on every authenticated route — the queue is global (single
// `preferences` row keyed by "me") so one mount per session is enough.

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

import { flushPreferences } from "@/features/offline/buckets/preferences";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";

export function PreferencesSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const tryFlush = useCallback(() => {
    void flushPreferences(getToken);
  }, [getToken]);

  // Kick once on attach so unflushed-from-prior-session fields don't wait
  // for the next event.
  useSyncTriggers(isLoaded && isSignedIn ? tryFlush : null, {
    kickOnAttach: true,
  });

  return null;
}
