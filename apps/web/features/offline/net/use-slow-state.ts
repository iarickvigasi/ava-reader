// React binding for slow-state.ts. Mirrors use-network-state.ts.

import { useSyncExternalStore } from "react";

import { isSlow, subscribeToSlowState } from "./slow-state";

function getServerSnapshot(): boolean {
  // SSR shows "not slow" — the signal only ever arrives from a live SW
  // message, which can't fire before hydration.
  return false;
}

export function useSlowState(): boolean {
  return useSyncExternalStore(subscribeToSlowState, isSlow, getServerSnapshot);
}
