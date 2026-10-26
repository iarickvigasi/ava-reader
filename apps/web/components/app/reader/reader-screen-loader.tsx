"use client";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { UnavailablePage } from "@/components/app/core/unavailable-page";
import { ReaderScreen } from "./reader-screen";
import { ReaderShellSkeleton } from "./reader-shell-skeleton";
import { useReaderScreenLoader } from "./use-reader-screen-loader";
import { useReaderOpeningHandoff } from "@/features/reader/use-reader-opening-handoff";
import { useReaderCover } from "@/features/reader/use-reader-cover";
import { ReaderCoverContext } from "@/features/reader/reader-cover-context";
import { ReaderCoverTransition } from "./view/reader-cover-transition";

export function ReaderScreenLoader() {
  const result = useReaderScreenLoader();
  const cover = useReaderCover();
  useReaderOpeningHandoff(Boolean(cover || result));
  if (!result)
    return (
      <ReaderCoverContext value={cover}>
        <ReaderCoverTransition>
          <ReaderShellSkeleton />
        </ReaderCoverTransition>
      </ReaderCoverContext>
    );
  if (result.kind === "not-found") return <UnavailablePage kind="notFound" />;
  if (result.kind === "loaded") {
    return (
      <ReaderCoverContext value={cover}>
        <ReaderCoverTransition
          book={result.payload.book}
          disabled={result.payload.status !== "READY"}
        >
          <ReaderScreen
            initialPayload={result.payload}
            libraryItemId={result.libraryItemId}
          />
        </ReaderCoverTransition>
      </ReaderCoverContext>
    );
  }
  return <OfflineRouteFallback routeKey="generic" />;
}
