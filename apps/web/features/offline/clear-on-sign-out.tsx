"use client";

// Render-less island that watches the Clerk session and drops user-scoped
// Dexie rows when the user signs out, so the next account on this browser
// profile never sees the previous user's cached data (display name in the
// nav, home dashboard, etc.).
//
// Mounted at the *root* layout (above the /app authenticated layout) so it
// stays mounted across the signed-in → signed-out transition. The /app
// layout unmounts on sign-out, so a watcher there would never see it fire.
//
// Covers both sign-out paths: our explicit `signOut()` call in the
// bootstrap panel AND Clerk's <UserButton> menu (which is opaque to us, so
// we can't hook it directly — watching userId is the universal trigger).

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { clearHome } from "./buckets/home";
import { clearCurrentUser } from "./buckets/me";

export function ClearOfflineOnSignOut() {
  const { isLoaded, userId } = useAuth();
  // Tracks the last userId we observed so we only act on the *transition*
  // truthy → null, not on the initial null on a fresh tab (no signed-in
  // user there to clear).
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = userId ?? null;

    // Fire only on a real sign-out edge: we *had* a user, now we don't.
    if (previous && !userId) {
      void clearCurrentUser();
      void clearHome();
    }
  }, [isLoaded, userId]);

  return null;
}
