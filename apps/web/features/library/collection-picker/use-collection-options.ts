"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import {
  readCollectionPickerOptions,
  revalidateLibrary,
  useLibraryView,
  type CollectionView,
} from "@/features/offline/buckets/library";
import { isOnline } from "@/features/offline/net/net-state";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function useCollectionOptions() {
  const { getToken, isLoaded } = useAuth();
  const online = useNetworkState();
  const library = useLibraryView();
  const [options, setOptions] = useState<CollectionView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const hasOptions = useRef(false);
  const tokenGetter = useRef(getToken);
  useEffect(() => {
    tokenGetter.current = getToken;
  }, [getToken]);

  const retry = useCallback(async () => {
    const attempt = ++generation.current;
    setLoading(!hasOptions.current);
    try {
      const cached = await readCollectionPickerOptions();
      if (attempt !== generation.current) return;
      hasOptions.current = cached !== null;
      setOptions(cached);
      if (cached !== null) setLoading(false);
      if (isOnline()) {
        await revalidateLibrary(() => tokenGetter.current());
        const fresh = await readCollectionPickerOptions();
        if (attempt === generation.current) {
          hasOptions.current = fresh !== null;
          setOptions(fresh);
        }
      }
    } catch {
      // Preserve a usable cache when revalidation or IndexedDB is unavailable.
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cached collections remain usable while offline auth is unavailable.
    void retry();
    return () => {
      generation.current += 1;
    };
  }, [retry, online, isLoaded]);

  return {
    collections:
      options === null
        ? []
        : (library?.collections ?? options).filter(
            ({ kind }) => kind === "CUSTOM",
          ),
    loading,
    unavailable: !loading && options === null,
    online,
    retry,
  };
}
