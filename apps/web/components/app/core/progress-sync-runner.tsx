"use client";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { useProgressSync } from "@/features/offline/buckets/progress";

export function ProgressSyncRunner() {
  const { getToken, isLoaded, isSignedIn } = useOfflineAuth();
  useProgressSync(isLoaded && isSignedIn ? getToken : null);
  return null;
}
