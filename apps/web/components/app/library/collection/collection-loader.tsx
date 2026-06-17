"use client";

// Client side of the generic collection shell (ADR 4). Slug from
// location.pathname, data from Dexie with a one-shot revalidation on miss
// while online. Freshness on a hit is owned by CollectionHydrator, exactly as
// on the old SSR page.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { LibraryCollectionPlaceholderPage } from "@/components/app/library/collection/collection-placeholder-page";
import { LibraryCollectionScreen } from "@/components/app/library/collection/collection-screen";
import {
  CollectionHydrator,
  revalidateCollection,
} from "@/features/offline/buckets/library";
import { readCollectionViewBySlug } from "@/features/offline/buckets/library/storage";
import { readWithRevalidate } from "@/features/offline/buckets/library/read-with-revalidate";
import { collectionViewToLibraryCollection } from "@/features/offline/buckets/library/view-to-collection";
import { isOnline } from "@/features/offline/net/net-state";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import type { LibraryCollection } from "@/lib/api-types";
import { slugFromPath } from "@/lib/app-routes";

const COLLECTION_PATH_PREFIX = "/app/library/collections/";

type LoaderState =
  | { status: "loading" }
  | { status: "ready"; collection: LibraryCollection }
  | { status: "unavailable" };

export function CollectionLoader() {
  const { getToken } = useAuth();
  const online = useNetworkState();
  const [state, setState] = useState<LoaderState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    const slug = slugFromPath(window.location.pathname, COLLECTION_PATH_PREFIX);
    if (!slug) {
      setState({ status: "unavailable" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void readWithRevalidate({
      isOnline,
      read: async () => {
        const view = await readCollectionViewBySlug(slug);
        return view ? collectionViewToLibraryCollection(view) : null;
      },
      revalidate: () => revalidateCollection(slug, getToken),
    }).then((collection) => {
      if (cancelled) {
        return;
      }
      setState(
        collection
          ? { status: "ready", collection }
          : { status: "unavailable" },
      );
    });
    return () => {
      cancelled = true;
    };
    // getToken's identity is deliberately not a dep; `attempt` drives reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Auto-retry when the connection returns and we have nothing to show.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setAttempt((current) => current + 1);
    }
  }, [online]);

  if (state.status === "loading") {
    return <LibraryCollectionPlaceholderPage />;
  }
  if (state.status === "unavailable") {
    return <OfflineRouteFallback routeKey="generic" />;
  }
  return (
    <>
      {/* Keeps the bucket hydrated + revalidating online, same as before. */}
      <CollectionHydrator initial={state.collection} />
      <LibraryCollectionScreen collection={state.collection} />
    </>
  );
}
