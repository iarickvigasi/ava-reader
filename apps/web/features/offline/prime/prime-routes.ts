// Orchestrates route-shell precaching (see [[14-route-precaching]]). The route
// list is fixed (static routes + shell sentinels — ADR 4), so this is a thin,
// stateless step: while online, hand the list to the SW. Posting is idempotent
// and cheap (the SW skips routes it has already cached), so the island re-runs
// once per page-session and on SW takeover without a persisted flag.

import { collectAppRoutes } from "./routes";

export type PrimeRoutesDeps = {
  isOnline: () => boolean;
  requestRoutePrecache: (routes: string[]) => Promise<void>;
};

export type PrimeRoutesResult = "done" | "skipped";

export async function primeRoutes(
  deps: PrimeRoutesDeps,
): Promise<PrimeRoutesResult> {
  if (!deps.isOnline()) {
    return "skipped";
  }
  await deps.requestRoutePrecache(collectAppRoutes());
  return "done";
}
