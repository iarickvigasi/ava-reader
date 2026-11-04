"use client";
import { useCallback, useEffect, useRef } from "react";
import { useSyncTriggers } from "../../net/use-sync-triggers";
import { createProgressSync } from "./create-progress-sync";
import type { GetProgressToken } from "./types";

export function useProgressSync(getToken: GetProgressToken | null) {
  const runner = useRef<ReturnType<typeof createProgressSync> | null>(null);
  useEffect(() => {
    if (!getToken) return;
    const active = createProgressSync(getToken);
    runner.current = active;
    return () => {
      runner.current = null;
      active.stop();
    };
  }, [getToken]);
  const run = useCallback(() => {
    void runner.current?.run();
  }, []);
  useSyncTriggers(getToken ? run : null, { kickOnAttach: true });
}
