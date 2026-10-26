"use client";

import { useReaderCover } from "@/features/reader/use-reader-cover";
import { ReaderCoverContext } from "@/features/reader/reader-cover-context";
import { ReaderLoadingCover } from "./view/reader-loading-cover";
import { PageSkeletonShell } from "@/components/app/shared/page-skeleton-shell";

export function ReaderStartupSkeleton() {
  const cover = useReaderCover();
  if (cover === undefined)
    return (
      <div
        aria-busy="true"
        data-reader-cover-pending
        className="h-dvh bg-paper"
      />
    );
  if (cover)
    return (
      <ReaderCoverContext value={cover}>
        <div className="relative mx-auto h-dvh max-w-375 md:pl-20">
          <div className="relative h-full">
            <ReaderLoadingCover loading />
          </div>
        </div>
      </ReaderCoverContext>
    );
  return (
    <PageSkeletonShell>
      <div className="grid gap-8 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, column) => (
          <div key={column} className="space-y-5">
            {Array.from({ length: 15 }, (_, line) => (
              <div key={line} className="h-4 rounded bg-paper-strong" />
            ))}
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}
