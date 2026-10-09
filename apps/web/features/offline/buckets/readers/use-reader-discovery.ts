"use client";

import { liveQuery } from "dexie";
import { useCallback, useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { withDeadline } from "@/features/auth/with-deadline";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { PublishedReader } from "@/lib/api-types/published-reader";
import { getDb } from "../../db";
import { useSyncTriggers } from "../../net/use-sync-triggers";
import { readReaderDiscovery } from "./read-reader-discovery";
import { writeReadersSnapshot } from "./storage";

export function useReaderDiscovery(): PublishedReader[] | null {
  const [readers, setReaders] = useState<PublishedReader[] | null>(null);
  const { getToken, isLoaded, isSignedIn } = useOfflineAuth();
  useEffect(() => {
    const subscription = liveQuery(readReaderDiscovery).subscribe({
      next: setReaders,
      error: () => setReaders([]),
    });
    return () => subscription.unsubscribe();
  }, []);
  const refresh = useCallback(() => {
    const db = getDb();
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${getPublicApiBaseUrl()}/api/readers`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return;
      const payload = (await withDeadline(
        response.json(),
      )) as PublishedReader[];
      if (db === getDb()) await writeReadersSnapshot(payload);
    })().catch(() => undefined);
  }, [getToken]);
  useSyncTriggers(isLoaded && isSignedIn ? refresh : null, {
    kickOnAttach: true,
  });
  return readers;
}
