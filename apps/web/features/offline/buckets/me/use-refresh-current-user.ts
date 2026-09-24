import { useCallback } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getPublicApiBaseUrl } from "@/lib/api";
import { withDeadline } from "@/features/auth/with-deadline";
import { useSyncTriggers } from "../../net/use-sync-triggers";
import { getDb } from "../../db";
import { applyCurrentUser } from "./storage";

export function useRefreshCurrentUser() {
  const { getToken, isLoaded, isSignedIn } = useOfflineAuth();
  const refresh = useCallback(() => {
    const db = getDb();
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${getPublicApiBaseUrl()}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return;
      const user = await withDeadline(response.json());
      if (db === getDb()) await applyCurrentUser(user);
    })().catch(() => undefined);
  }, [getToken]);
  useSyncTriggers(isLoaded && isSignedIn ? refresh : null, {
    kickOnAttach: true,
  });
}
