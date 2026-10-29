"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { readCatalogPresence } from "./read-catalog-presence";

export function useCatalogPresence(entryId: string, initialId?: string | null) {
  const { userId } = useOfflineAuth();
  const [result, setResult] = useState<{
    key: string;
    present: boolean;
  } | null>(null);
  const key = `${userId}:${entryId}:${initialId}`;
  useEffect(() => {
    const subscription = liveQuery(() =>
      readCatalogPresence(entryId, initialId),
    ).subscribe({
      next: (present) => setResult({ key, present }),
      error: () => {},
    });
    return () => subscription.unsubscribe();
  }, [entryId, initialId, key]);
  return result?.key === key ? result.present : Boolean(initialId);
}
