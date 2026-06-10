"use client";

// Render-less island that asks the service worker to precache every app route's
// shell (see [[14-route-precaching]]). Mounted in AppShell, so it runs on *any*
// /app route — visiting one route makes the rest load offline. Wires the real
// seams into the testable `primeRoutes` orchestrator.
//
// Re-runs on connection regain and route change until a full pass completes:
// a deep-link landing before the library view is hydrated precaches only the
// static routes ("partial"), then the next navigation fills in the per-entity
// routes. A module-level guard stops further work once a full pass lands.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { readLibraryView } from "@/features/offline/buckets/library/storage";
import { isOnline } from "@/features/offline/net-state";
import { hasMetaFlag, setMetaFlag } from "@/features/offline/prime/meta";
import { primeRoutes } from "@/features/offline/prime/prime-routes";
import { requestRoutePrecache } from "@/features/offline/sw/precache-routes";
import { useNetworkState } from "@/features/offline/use-network-state";

let completed = false;

export function RoutePrecacheRunner() {
  const online = useNetworkState();
  const pathname = usePathname();
  const running = useRef(false);

  useEffect(() => {
    if (completed || !online || running.current) {
      return;
    }
    running.current = true;
    void (async () => {
      try {
        const result = await primeRoutes({
          isOnline,
          hasMetaFlag,
          setMetaFlag,
          readLibraryView,
          requestRoutePrecache,
          now: () => new Date().toISOString(),
        });
        // "partial" means the library view wasn't ready — leave the guard open
        // so the next navigation retries the per-entity routes.
        if (result !== "partial") {
          completed = true;
        }
      } finally {
        running.current = false;
      }
    })();
  }, [online, pathname]);

  return null;
}
