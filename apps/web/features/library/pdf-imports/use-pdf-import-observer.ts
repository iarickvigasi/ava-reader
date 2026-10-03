"use client";

import { useEffect } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { observePdfImports } from "@/features/offline/buckets/library";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function usePdfImportObserver() {
  const { getToken, isLoaded, isSignedIn, userId } = useOfflineAuth();
  const online = useNetworkState();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !online) return;
    let stopped = false;
    let running = false;
    let delay = 5_000;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (stopped || running) return;
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") {
        running = true;
        try {
          const active = await observePdfImports(getToken);
          delay = active ? 5_000 : 30_000;
        } catch {
          delay = Math.min(delay * 2, 30_000);
        } finally {
          running = false;
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), delay);
    }
    const wake = () => {
      void tick();
    };
    void tick();
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [getToken, isLoaded, isSignedIn, online, userId]);
}
