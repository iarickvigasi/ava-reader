"use client";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { UnavailablePage } from "@/components/app/core/unavailable-page";
import { ReaderScreen } from "./reader-screen";
import { ReaderShellSkeleton } from "./reader-shell-skeleton";
import { useReaderScreenLoader } from "./use-reader-screen-loader";

export function ReaderScreenLoader() {
  const result = useReaderScreenLoader();
  if (!result) return <ReaderShellSkeleton />;
  if (result.kind === "not-found") return <UnavailablePage kind="notFound" />;
  if (result.kind === "loaded") {
    return (
      <ReaderScreen
        initialPayload={result.payload}
        libraryItemId={result.libraryItemId}
      />
    );
  }
  return <OfflineRouteFallback routeKey="generic" />;
}
