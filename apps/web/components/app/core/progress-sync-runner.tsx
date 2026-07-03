"use client";

// Drains locally-dirty reading progress up to the server on the usual offline-
// sync triggers (online event, tab regains visibility, mount). Mounted in
// AppShell so it runs on every authenticated route, independent of the reader —
// this is what lets offline reading sync without reopening the book (see
// specs/5-reading-sessions-progress). The flush is single-flight and online-
// guarded, so firing it from several triggers is cheap.

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { flushDirtyProgress } from "@/features/offline/buckets/progress";

export function ProgressSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const tryFlush = () => {
      void flushDirtyProgress(getToken);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tryFlush();
      }
    };
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", onVisible);
    // Kick once on mount so progress left dirty by a prior session (reader
    // closed while offline) syncs without waiting for the next event.
    tryFlush();
    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
