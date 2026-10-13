"use client";

import { BookCover } from "@/components/app/shared/book-cover";
import { useContext, useEffect } from "react";
import { ReaderCoverContext } from "@/features/reader/reader-cover-context";
import { ReaderCoverLoadingContext } from "@/features/reader/reader-cover-loading-context";
import { useReaderCover } from "@/features/reader/use-reader-cover";
import { useReaderCoverHold } from "@/features/reader/use-reader-cover-hold";
import { resolveApiAssetUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ReaderBookPayload } from "@/lib/api-types";
import { ReaderTextSkeleton } from "./reader-text-skeleton";

export function ReaderLoadingCover({
  loading,
  book,
}: {
  loading: boolean;
  book?: ReaderBookPayload;
}) {
  const routeCover = useContext(ReaderCoverContext);
  const cached = useReaderCover(book?.slug);
  const cover = routeCover ?? cached ?? (book ? { ...book, src: null } : null);
  const holding = useReaderCoverHold(Boolean(cover));
  const visible = loading || holding;
  const reportLoading = useContext(ReaderCoverLoadingContext);
  useEffect(() => {
    reportLoading?.reportLoading(loading);
  }, [loading, reportLoading]);
  if (reportLoading)
    return loading && !reportLoading.opening ? <ReaderTextSkeleton /> : null;
  if (!cover) return null;
  return (
    <div
      aria-hidden="true"
      data-reader-loading-cover
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex overflow-hidden items-center justify-center p-3 transition-[opacity,backdrop-filter,background-color] duration-300 ease-out motion-reduce:transition-none",
        visible
          ? "bg-paper opacity-100 backdrop-blur-sm"
          : "bg-paper/0 opacity-0 backdrop-blur-none",
      )}
    >
      {cover && (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center [container-type:size] transition-[filter,opacity] duration-300 ease-out motion-reduce:transition-none",
            visible
              ? "opacity-100 blur-none"
              : "opacity-0 blur-sm motion-reduce:blur-none",
          )}
        >
          <BookCover
            fit
            alt={cover.title}
            title={cover.title}
            src={resolveApiAssetUrl(cover.src)}
            libraryItemId={cover.libraryItemId}
            className="shrink-0 shadow-(--shadow-card)"
          />
        </div>
      )}
    </div>
  );
}
