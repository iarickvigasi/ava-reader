"use client";

// Client render path for the home screen when the server fetch failed
// (offline). Reads the last-cached home payload from Dexie and renders the
// normal HomeScreen, or the offline-route fallback when nothing is cached
// (the app has never loaded home online on this device).

import { useHomeFromCache } from "@/features/offline/buckets/home";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { HomeScreen } from "./home-screen";

export function HomeScreenFromCache() {
  const state = useHomeFromCache();

  if (state.status === "loading") {
    // Brief: Dexie resolves in a tick. Render nothing rather than a skeleton
    // that would flash before the cached payload arrives.
    return null;
  }

  if (state.status === "empty") {
    return <OfflineRouteFallback routeKey="home" />;
  }

  return <HomeScreen home={state.payload} />;
}
