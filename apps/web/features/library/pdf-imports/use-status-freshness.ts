"use client";
import { useSyncExternalStore } from "react";
import {
  pdfObservationIsFresh,
  subscribePdfObservationHealth,
} from "@/features/offline/buckets/library";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function usePdfStatusFreshness() {
  const online = useNetworkState();
  const fresh = useSyncExternalStore(
    subscribePdfObservationHealth,
    pdfObservationIsFresh,
    () => false,
  );
  return online && fresh;
}
