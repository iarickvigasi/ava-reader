"use client";

// React hooks bridging the library bucket. Pages call these instead of
// reading the server payload directly; the page-level client island still
// hydrates the bucket with the RSC payload so the first render has data.

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect } from "react";
import { useSyncExternalStore } from "react";

import type {
  LibraryBookInfo,
  LibraryCollection,
  LibraryPayload,
} from "@/lib/api-types/library";

import { useNetworkState } from "../../net/use-network-state";

import {
  getLibrarySnapshot,
  getServerSnapshot,
  hydrateBookInfo,
  hydrateCollection,
  hydrateFromPayload,
  refreshFromDb,
  subscribe,
} from "./bucket";
import {
  revalidateBookInfo,
  revalidateCollection,
  revalidateLibrary,
} from "./revalidate";
import { flushOfflineIntents } from "./offline-intent/offline-intent-sync";
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
    void flushOfflineIntents(getToken);
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
    // Sync any offline "keep" toggles made on this page before flowing fresh
    // data back in.
    void flushOfflineIntents(getToken);
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
  return (
    view.collections.find((collection) => collection.slug === slug) ?? null
  );
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
    // The loader may supply an overlaid cache snapshot. Seed only a missing
    // row; online revalidation is the authoritative write path.
    void hydrateBookInfo(initial, { seedOnly: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded || !online) {
      return;
    }
    // Sync any offline "keep" / "release" toggle made on this page once we're
    // back online, even if the user never visits the library list.
    void flushOfflineIntents(getToken);
    void revalidateBookInfo(slug, getToken);
  }, [slug, getToken, isLoaded, online]);
}

export { useBookInfo } from "./book-info/use-book-info";
