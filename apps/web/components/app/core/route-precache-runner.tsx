"use client";

// Render-less island that asks the service worker to precache the app's route
// shells (see [[14-route-precaching]]). Mounted in AppShell, so it runs on
// *any* /app route. The route list is fixed (static routes + generic-shell
// sentinels — ADR 4), so a single successful pass per page-session suffices;
// it re-runs on connection regain and on SW takeover (a new build's worker
// starts with an empty versioned cache).

import { useEffect, useRef, useState } from "react";

import { isOnline } from "@/features/offline/net-state";
import { primeRoutes } from "@/features/offline/prime/prime-routes";
import { requestRoutePrecache } from "@/features/offline/sw/precache-routes";
import { useNetworkState } from "@/features/offline/use-network-state";

// Session guard: once a pass posts the route list, don't re-post on every
// render. Reset on SW takeover so the new version's cache is filled.
let completed = false;

export function RoutePrecacheRunner() {
  const online = useNetworkState();
  const running = useRef(false);
  const [swEpoch, setSwEpoch] = useState(0);

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
        const result = await primeRoutes({ isOnline, requestRoutePrecache });
        if (result === "done") {
          completed = true;
        }
      } finally {
        running.current = false;
      }
    })();
  }, [online, swEpoch]);

  return null;
}
