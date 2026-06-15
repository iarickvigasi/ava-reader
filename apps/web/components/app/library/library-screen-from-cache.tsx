"use client";

// Client render path for the library screen when the server fetch failed or
// auth couldn't be verified (offline). Reads the last-cached library view
// from Dexie and renders the normal LibraryScreen (mounting LibraryHydrator
// so the bucket + online revalidation behave exactly as on the SSR path), or
// the offline-route fallback when nothing is cached yet.

import { useEffect, useState } from "react";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { LibraryHydrator } from "@/features/offline/buckets/library";
import { readLibraryView } from "@/features/offline/buckets/library/storage";
import { collectionViewToLibraryCollection } from "@/features/offline/buckets/library/view-to-collection";
import type { LibraryPayload } from "@/lib/api-types";

import { LibraryScreen } from "./library-screen";

type CacheState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; payload: LibraryPayload };

export function LibraryScreenFromCache() {
  const [state, setState] = useState<CacheState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void readLibraryView().then((view) => {
      if (cancelled) {
        return;
      }
      if (!view) {
        setState({ status: "empty" });
        return;
      }
      setState({
        status: "ready",
        payload: {
          summary: view.summary,
          collections: view.collections.map(collectionViewToLibraryCollection),
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    // Brief: Dexie resolves in a tick. Render nothing rather than a skeleton
    // that would flash before the cached payload arrives.
    return null;
  }
  if (state.status === "empty") {
    return <OfflineRouteFallback routeKey="generic" />;
  }
  return (
    <>
      <LibraryHydrator initial={state.payload} />
      <LibraryScreen library={state.payload} />
    </>
  );
}
