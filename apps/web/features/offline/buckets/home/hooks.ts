"use client";

// React bindings for the home cache.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import type { HomePayload } from "@/lib/api-types/home";

import { useNetworkState } from "../../net/use-network-state";

import { revalidateHome } from "./revalidate";
import { applyHome, readHome } from "./storage";

// Seeds Dexie from the RSC payload, then revalidates against the API while
// online. Pass `null` when the server fetch failed (offline) — we keep the
// cached payload and skip the seed.
export function useHydrateHome(initial: HomePayload | null): void {
  const { getToken, isLoaded } = useAuth();
  const online = useNetworkState();

  useEffect(() => {
    if (!initial) {
      return;
    }
    void applyHome(initial);
  }, [initial]);

  useEffect(() => {
    if (!isLoaded || !online) {
      return;
    }
    void revalidateHome(getToken);
  }, [getToken, isLoaded, online]);
}

// Read state for the offline render path. `status` distinguishes:
// - "loading": Dexie hasn't resolved yet,
// - "ready": we have a payload (from cache),
// - "empty": Dexie has nothing (app never loaded home online) → caller shows
//   the offline-route fallback.
export type HomeCacheState =
  | { status: "loading"; payload: null }
  | { status: "ready"; payload: HomePayload }
  | { status: "empty"; payload: null };

export function useHomeFromCache(): HomeCacheState {
  const [state, setState] = useState<HomeCacheState>({
    status: "loading",
    payload: null,
  });

  useEffect(() => {
    let cancelled = false;
    void readHome().then((payload) => {
      if (cancelled) {
        return;
      }
      setState(
        payload
          ? { status: "ready", payload }
          : { status: "empty", payload: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
