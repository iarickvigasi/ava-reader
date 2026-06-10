// Orchestrates route-shell precaching (see [[14-route-precaching]]). Stays
// Dexie/SW-free behind injected seams so the control flow is unit-testable;
// the AppShell island supplies the real implementations.
//
// Deliberately stateless — no persisted "done" flag. Posting the route list is
// idempotent and cheap (the SW skips routes it has already cached), so the
// island re-runs once per page-session and on SW takeover. That self-heals the
// SW-update race (a post that landed on a worker whose cache was then evicted)
// and picks up newly-added books, instead of locking out forever on a flag that
// a single failed pass set optimistically.

import type { LibraryView } from "../buckets/library/types";

import { collectAppRoutes } from "./routes";

export type PrimeRoutesDeps = {
  isOnline: () => boolean;
  readLibraryView: () => Promise<LibraryView | null>;
  requestRoutePrecache: (routes: string[]) => Promise<void>;
};

// "done" — full pass: the library view was present, so every route was posted.
// "partial" — the view wasn't hydrated yet, so only static routes went; the
//   next navigation (or SW takeover) fills in the per-entity routes.
// "skipped" — offline.
export type PrimeRoutesResult = "done" | "partial" | "skipped";

export async function primeRoutes(
  deps: PrimeRoutesDeps,
): Promise<PrimeRoutesResult> {
  if (!deps.isOnline()) {
    return "skipped";
  }
  const view = await deps.readLibraryView();
  await deps.requestRoutePrecache(collectAppRoutes(view));
  return view ? "done" : "partial";
}
