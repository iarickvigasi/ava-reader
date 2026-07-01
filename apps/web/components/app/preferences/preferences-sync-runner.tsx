"use client";

// Drains any locally-dirty preference fields on the usual offline-sync
// triggers (online event, tab regains visibility). Mounted in AppShell so
// it runs on every authenticated route — the queue is global (single
// `preferences` row keyed by "me") so one mount per session is enough.

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { flushPreferences } from "@/features/offline/buckets/preferences";

export function PreferencesSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const tryFlush = () => {
      void flushPreferences(getToken);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tryFlush();
      }
    };
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", onVisible);
    // Also kick a flush once on mount so unflushed-from-prior-session
    // fields don't wait for the next event.
    tryFlush();
    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
