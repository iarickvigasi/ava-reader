// React binding for prime-progress.ts. Use this in components; the underlying
// store is plain JS so the (non-React) background primer can write it.

import { useSyncExternalStore } from "react";

import {
  getPrimeProgress,
  subscribeToPrimeProgress,
  type PrimeProgress,
} from "./prime-progress";

function getServerSnapshot(): PrimeProgress | null {
  // No priming runs during SSR.
  return null;
}

export function usePrimeProgress(): PrimeProgress | null {
  return useSyncExternalStore(
    subscribeToPrimeProgress,
    getPrimeProgress,
    getServerSnapshot,
  );
}
