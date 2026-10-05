"use client";

import { useNetworkState } from "@/features/offline/net/use-network-state";
import { UnavailablePage } from "./unavailable-page";

export type OfflineRouteKey = "admin" | "insights" | "home" | "generic";

export function OfflineRouteFallback({
  routeKey,
  reason = "unavailable",
  onRetry,
}: {
  routeKey: OfflineRouteKey;
  onRetry?: () => void;
  reason?: "apiUnavailable" | "authUnavailable" | "unavailable";
}) {
  const online = useNetworkState();
  return (
    <UnavailablePage
      kind={online ? reason : "offline"}
      routeKey={routeKey}
      onRetry={onRetry}
    />
  );
}
