"use client";

// Render-less island that asks the service worker to precache the app's route
// shells (see [[14-route-precaching]]). Mounted in AppShell, so it runs on
// *any* /app route. The route list is fixed (static routes + generic-shell
// sentinels — ADR 4), so a single successful pass per page-session suffices;
// it re-runs on connection regain and on SW takeover (a new build's worker
// starts with an empty versioned cache).

import { useEffect, useRef, useState } from "react";

import { isOnline } from "@/features/offline/net/net-state";
import { primeRoutes } from "@/features/offline/prime/prime-routes";
import { requestRoutePrecache } from "@/features/offline/sw/precache-routes";
import {
  getShellsReady,
  setShellsReady,
} from "@/features/offline/status/shells-ready";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function RoutePrecacheRunner() {
  const online = useNetworkState();
  const running = useRef(false);
  const [swEpoch, setSwEpoch] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onControllerChange = () => {
      // The new version starts with an empty cache — the shells aren't ready
      // again until its own pass confirms them. Clearing this also re-arms the
      // precache pass below (its guard reads shells-ready).
      setShellsReady(false);
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

  // The shells-ready signal is the single source of truth for "this session's
  // precache is confirmed complete": it gates this pass (don't re-post once
  // done) and drives the header chip. A pass that ends "incomplete" (offline
  // mid-pass, partial cache) leaves it false, so a reconnect or SW takeover
  // retries — never latched at post time, which used to strand the library
  // shell.
  useEffect(() => {
    if (getShellsReady() || !online || running.current) {
      return;
    }
    running.current = true;
    void (async () => {
      try {
        const result = await primeRoutes({ isOnline, requestRoutePrecache });
        if (result === "done") {
          setShellsReady(true);
        }
      } finally {
        running.current = false;
      }
    })();
  }, [online, swEpoch]);

  return null;
}
