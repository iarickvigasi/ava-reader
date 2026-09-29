"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getActiveUserId } from "@/features/offline/db";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { resolveAuthState } from "./auth-state";

const RECONNECTING_NOTICE_MS = 6_000;

export function useAuthNotice() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const online = useNetworkState();
  const userId = getActiveUserId();
  const state = resolveAuthState({
    online,
    loaded: clerk.loaded,
    status: clerk.status,
    signedIn: isSignedIn,
  });
  const [dismissal, setDismissal] = useState({ userId, dismissed: false });
  // AppShell survives navigation. Only recovery or an owner change starts a new episode.
  if (
    dismissal.userId !== userId ||
    (state === "authenticated" && dismissal.dismissed)
  ) {
    setDismissal({ userId, dismissed: false });
  }
  const reconnecting = online && !!userId && state === "unavailable";
  const dismissed = dismissal.userId === userId && dismissal.dismissed;
  useEffect(() => {
    if (!reconnecting || dismissed) return;
    const timer = setTimeout(
      () => setDismissal({ userId, dismissed: true }),
      RECONNECTING_NOTICE_MS,
    );
    return () => clearTimeout(timer);
  }, [reconnecting, dismissed, userId]);
  return {
    state,
    visible:
      online &&
      !!userId &&
      (state === "sign-in-required" || (reconnecting && !dismissed)),
    dismiss: () => setDismissal({ userId, dismissed: true }),
  };
}
