"use client";
import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { UnavailablePage } from "@/components/app/core/unavailable-page";
import { LibraryCollectionPlaceholderPage } from "./collection-placeholder-page";
import { LibraryCollectionScreen } from "./collection-screen";
import { CollectionHydrator } from "@/features/offline/buckets/library";
import { useCollectionLoader } from "./use-collection-loader";

export function CollectionLoader() {
  const state = useCollectionLoader();
  if (state.status === "loading") {
    return <LibraryCollectionPlaceholderPage />;
  }
  if (state.status === "notFound") {
    return <UnavailablePage kind="notFound" />;
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
