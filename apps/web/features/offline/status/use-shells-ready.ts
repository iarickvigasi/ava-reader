// React binding for shells-ready.ts. Use this in components; the underlying
// store is plain JS so the route-precache runner's SW-message handler can write
// it outside React.

import { useSyncExternalStore } from "react";

import { getShellsReady, subscribeToShellsReady } from "./shells-ready";

function getServerSnapshot(): boolean {
  // No service worker (and no precache) during SSR.
  return false;
}

export function useShellsReady(): boolean {
  return useSyncExternalStore(
    subscribeToShellsReady,
    getShellsReady,
    getServerSnapshot,
  );
}
