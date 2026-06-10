"use client";

// Render-less island that asks the service worker to precache every app route's
// shell (see [[14-route-precaching]]). Mounted in AppShell, so it runs on *any*
// /app route — visiting one route makes the rest load offline. Wires the real
// seams into the testable `primeRoutes` orchestrator.
//
// Re-runs on connection regain, route change, and SW takeover until a full pass
// lands. A deep link that arrives before the library view is hydrated precaches
// only the static routes ("partial"); the next navigation fills in the rest.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { readLibraryView } from "@/features/offline/buckets/library/storage";
import { isOnline } from "@/features/offline/net-state";
import { primeRoutes } from "@/features/offline/prime/prime-routes";
import { requestRoutePrecache } from "@/features/offline/sw/precache-routes";
import { useNetworkState } from "@/features/offline/use-network-state";

// Session guard: once a full pass posts the route list, don't re-post on every
// in-app navigation. Reset on SW takeover so the new version's cache is filled.
let completed = false;

export function RoutePrecacheRunner() {
  const online = useNetworkState();
  const pathname = usePathname();
  const running = useRef(false);
  const [swEpoch, setSwEpoch] = useState(0);

  // A new service worker taking control (e.g. after a deploy) means a fresh,
  // empty versioned cache — re-run so its route shells get precached too.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onControllerChange = () => {
      completed = false;
      setSwEpoch((epoch) => epoch + 1);
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
  }, []);

  useEffect(() => {
    if (completed || !online || running.current) {
      return;
    }
    running.current = true;
    void (async () => {
      try {
        const result = await primeRoutes({
          isOnline,
          readLibraryView,
          requestRoutePrecache,
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
  }, [online, pathname, swEpoch]);

  return null;
}
