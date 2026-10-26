"use client";

import { useContext } from "react";
import { ReaderCoverContext } from "@/features/reader/reader-cover-context";
import { cn } from "@/lib/cn";
import { ReaderTextSkeleton } from "./view/reader-text-skeleton";
import { ReaderLoadingCover } from "./view/reader-loading-cover";

// Pulse skeleton shown while the reader shell resolves its payload from Dexie
// or the network (ADR 4). Mirrors the reader's exact chrome (same canvas,
// sidebar offset, and column width as reader-screen.tsx / ready-reader.tsx)
// so the swap to the real screen doesn't shift layout.

export function ReaderShellSkeleton() {
  const cover = useContext(ReaderCoverContext);
  return (
    <div className="h-dvh bg-paper text-ink">
      <div className="relative mx-auto h-full max-w-375 overflow-hidden md:pl-20">
        <div className="relative h-full px-4 pb-2 pt-2 sm:px-6 sm:pb-5 sm:pt-8 md:px-7 md:pt-8 lg:px-8">
          <ReaderLoadingCover loading />
          <section
            data-reader-shell-placeholder
            className={cn(
              "mx-auto flex h-full max-w-312 min-w-0 flex-col",
              cover !== null && "invisible",
            )}
          >
            <div className="hidden sm:block">
              <div className="h-7 w-72 animate-pulse rounded bg-paper-strong" />
            </div>
            <div className="relative mt-4 min-h-0 flex-1 sm:mt-8">
              <ReaderTextSkeleton />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
