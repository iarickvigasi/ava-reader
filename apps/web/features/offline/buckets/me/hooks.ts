"use client";

// React bindings for the current-user cache.
//
// The app layout fetches /api/me server-side and passes the result down as
// `initial`. When that fetch fails (offline), `initial` is null and these
// hooks recover the last-known user from Dexie so the nav still renders.

import { useEffect, useState } from "react";

import type { CurrentUserPayload } from "@/lib/api-types/user";

import { applyCurrentUser, readCurrentUser } from "./storage";

// Seeds Dexie with the freshly-fetched user. No-op when `initial` is null
// (offline) — we keep whatever was cached previously.
export function useHydrateCurrentUser(
  initial: CurrentUserPayload | null,
): void {
  useEffect(() => {
    if (!initial) {
      return;
    }
    void applyCurrentUser(initial);
  }, [initial]);
}

// Returns the best-available current user:
// - `initial` immediately (server-fetched; matches SSR so no hydration jump),
// - falls back to the Dexie-cached row once it resolves when `initial` is null.
//
// `initial` is derived, not mirrored into state, so the common (online) path
// never triggers a setState-in-effect. Only the offline branch reads the
// cache asynchronously and stores the result.
export function useCurrentUserCached(
  initial: CurrentUserPayload | null,
): CurrentUserPayload | null {
  const [cached, setCached] = useState<CurrentUserPayload | null>(null);

  useEffect(() => {
    if (initial) {
      // Server payload present — nothing to read from the cache.
      return;
    }
    let cancelled = false;
    void readCurrentUser().then((row) => {
      if (!cancelled && row) {
        setCached(row);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return initial ?? cached;
}
