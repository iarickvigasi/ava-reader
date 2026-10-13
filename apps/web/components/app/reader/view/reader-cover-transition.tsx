"use client";

import type { ReactNode } from "react";
import { useReaderCoverTransition } from "@/features/reader/use-reader-cover-transition";
import { useReaderDevice } from "@/features/reader/modes/use-reader-device";
import { ReaderCoverLoadingContext } from "@/features/reader/reader-cover-loading-context";
import type { ReaderBookPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderLoadingCover } from "./reader-loading-cover";

export function ReaderCoverTransition({
  children,
  book,
  disabled = false,
}: {
  children: ReactNode;
  book?: ReaderBookPayload;
  disabled?: boolean;
}) {
  const transition = useReaderCoverTransition();
  const isPhone = useReaderDevice() !== "desktop";
  return (
    <div className="relative h-full" data-reader-cover-transition>
      <ReaderCoverLoadingContext value={transition}>
        {children}
      </ReaderCoverLoadingContext>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 mx-auto max-w-375",
          !isPhone && "md:pl-20",
        )}
      >
        <div className="relative h-full">
          {!disabled && (
            <ReaderLoadingCover loading={transition.opening} book={book} />
          )}
        </div>
      </div>
    </div>
  );
}
