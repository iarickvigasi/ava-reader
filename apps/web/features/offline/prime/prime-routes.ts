// Orchestrates route-shell precaching (see [[14-route-precaching]]). Runs once
// per device on a full pass, but stays Dexie/SW-free behind injected seams so
// the control flow is unit-testable. Wiring (the AppShell island) supplies the
// real implementations.

import type { LibraryView } from "../buckets/library/types";

import { META_KEY_ROUTES_DONE } from "./meta";
import { collectAppRoutes } from "./routes";

export type PrimeRoutesDeps = {
  isOnline: () => boolean;
  hasMetaFlag: (key: string) => Promise<boolean>;
  setMetaFlag: (key: string, value: string) => Promise<void>;
  readLibraryView: () => Promise<LibraryView | null>;
  requestRoutePrecache: (routes: string[]) => Promise<void>;
  now: () => string;
};

// "done" — full pass, flag set, never runs again on this device.
// "partial" — static routes precached but the library view wasn't hydrated yet,
//   so per-entity routes are deferred to the next navigation (flag NOT set).
// "skipped" — offline, or a full pass already completed.
export type PrimeRoutesResult = "done" | "partial" | "skipped";

export async function primeRoutes(
  deps: PrimeRoutesDeps,
): Promise<PrimeRoutesResult> {
  if (!deps.isOnline()) {
    return "skipped";
  }
  if (await deps.hasMetaFlag(META_KEY_ROUTES_DONE)) {
    return "skipped";
  }
  const view = await deps.readLibraryView();
  await deps.requestRoutePrecache(collectAppRoutes(view));
  if (view) {
    await deps.setMetaFlag(META_KEY_ROUTES_DONE, deps.now());
    return "done";
  }
  return "partial";
}
