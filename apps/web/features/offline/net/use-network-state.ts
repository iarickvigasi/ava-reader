// React binding for net-state.ts. Use this in components; the underlying
// store is plain JS so it can be consumed from non-React code (the sync
// runner, background flushes) too.

import { useSyncExternalStore } from "react";

import { isOnline, subscribeToNetworkState } from "./net-state";

function getServerSnapshot(): boolean {
  // SSR shows the "online" state — the very first client paint corrects this
  // if the user is actually offline. This avoids a hydration mismatch where
  // the server renders an offline indicator that briefly flashes for online
  // users.
  return true;
}

export function useNetworkState(): boolean {
  return useSyncExternalStore(
    subscribeToNetworkState,
    isOnline,
    getServerSnapshot,
  );
}
