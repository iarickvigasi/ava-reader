"use client";

import { useState, useTransition } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import {
  acquireCatalogBook,
  useCatalogPresence,
} from "@/features/offline/buckets/library";

export function useFeaturedAdd(entryId: string, libraryItemId?: string | null) {
  const { getToken } = useOfflineAuth();
  const present = useCatalogPresence(entryId, libraryItemId);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const add = () => {
    if (pending || present) return;
    startTransition(async () => {
      setError(false);
      try {
        await acquireCatalogBook(entryId, getToken);
      } catch {
        setError(true);
      }
    });
  };
  return { present, pending, error, add };
}
