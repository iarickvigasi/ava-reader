"use client";

// React hooks bridging the library bucket. Pages call these instead of
// reading the server payload directly; the page-level client island still
// hydrates the bucket with the RSC payload so the first render has data.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";

import type {
  LibraryBookInfo,
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";

import { useNetworkState } from "../../use-network-state";

import {
  getLibrarySnapshot,
  getServerSnapshot,
  hydrateBookInfo,
  hydrateCollection,
  hydrateFromPayload,
  readBookInfo,
  refreshFromDb,
  subscribe,
} from "./bucket";
import {
  revalidateBookInfo,
  revalidateCollection,
  revalidateLibrary,
} from "./revalidate";
import type { CollectionView, LibraryView } from "./types";

// Read the current library view. Returns null until the bucket finishes
// hydrating from Dexie or from the page-supplied initial payload.
export function useLibraryView(): LibraryView | null {
  return useSyncExternalStore(subscribe, getLibrarySnapshot, getServerSnapshot);
}

// Side-effect hook: hydrates the bucket from an initial RSC payload and
// schedules a revalidation against the API while online. Call this once at
// the top of the library page's client island.
export function useHydrateLibrary(initial: LibraryPayload) {
  const { getToken, isLoaded } = useAuth();
  const online = useNetworkState();

  useEffect(() => {
    // First mount: prefer Dexie if it already has data (faster paint, also
    // wins when the user is offline). If empty, seed from the RSC payload.
    void (async () => {
      await refreshFromDb();
      if (!getLibrarySnapshot()) {
        await hydrateFromPayload(initial);
      }
    })();
    // The `initial` payload is intentionally a one-shot — we don't want to
    // re-hydrate from it after subsequent client navigations. Pages that
    // need fresh data trigger revalidation through `online`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !online) {
      return;
    }
    void revalidateLibrary(getToken);
  }, [getToken, isLoaded, online]);
}

// Same idea for a single collection page. Hydrates the targeted collection
// from the RSC payload, then revalidates against the API.
export function useHydrateCollection(initial: LibraryCollection) {
  const { getToken, isLoaded } = useAuth();
  const online = useNetworkState();
  const slug = initial.slug;

  useEffect(() => {
    void (async () => {
      await refreshFromDb();
      // Seed Dexie if we've never seen this collection before.
      if (!getLibrarySnapshot()) {
        await hydrateCollection(initial);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !online) {
      return;
    }
    void revalidateCollection(slug, getToken);
  }, [slug, getToken, isLoaded, online]);
}

// Read a single collection out of the library view. Components on the
// collection screen go through this so a server revalidation that re-orders
// books propagates without a manual refetch.
export function useCollectionView(slug: string): CollectionView | null {
  const view = useLibraryView();
  if (!view) {
    return null;
  }
  return view.collections.find((collection) => collection.slug === slug) ?? null;
}

// Book-info hydration hook. Two responsibilities:
// 1. Seed Dexie with the initial RSC payload so the next visit (potentially
//    offline) works.
// 2. Revalidate against the API while online so a stale local copy gets
//    refreshed.
//
// Unlike useHydrateLibrary, this one does NOT need to feed the in-memory
// bucket — the screen reads from Dexie directly via `useBookInfo`.
export function useHydrateBookInfo(initial: LibraryBookInfo) {
  const { getToken, isLoaded } = useAuth();
  const online = useNetworkState();
  const slug = initial.slug;

  useEffect(() => {
    void hydrateBookInfo(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !online) {
      return;
    }
    void revalidateBookInfo(slug, getToken);
  }, [slug, getToken, isLoaded, online]);
}

// Read a single book-info row out of Dexie. Returns:
// - `initial` (always) for the first render — server-rendered RSC payload
//   matches this so there's no hydration mismatch.
// - The cached row once Dexie resolves; identical to initial when the
//   page loads online for the first time, possibly older fields if the
//   page is being re-rendered offline after a previous visit.
export function useBookInfo(
  slug: string,
  initial: LibraryBookInfo,
): LibraryBookInfo {
  const [value, setValue] = useState<LibraryBookInfo>(initial);

  useEffect(() => {
    let cancelled = false;
    void readBookInfo(slug).then((row) => {
      if (cancelled || !row) {
        return;
      }
      setValue(row);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return value;
}
