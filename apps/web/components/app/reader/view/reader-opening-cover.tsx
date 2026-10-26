"use client";

import { ReaderCoverContext } from "@/features/reader/reader-cover-context";
import { useReaderOpeningCover } from "@/features/reader/use-reader-opening-cover";
import { useReaderDevice } from "@/features/reader/modes/use-reader-device";
import { cn } from "@/lib/cn";
import { ReaderLoadingCover } from "./reader-loading-cover";

export function ReaderOpeningCover() {
  const opening = useReaderOpeningCover();
  const isPhone = useReaderDevice() !== "desktop";
  if (!opening) return null;
  return (
    <ReaderCoverContext value={opening.cover}>
      <div
        data-reader-opening-cover
        className="pointer-events-none fixed inset-0 z-50 bg-paper"
      >
        <div className={cn("mx-auto h-full max-w-375", !isPhone && "md:pl-20")}>
          <div className="relative h-full">
            <ReaderLoadingCover loading />
          </div>
        </div>
      </div>
    </ReaderCoverContext>
  );
}
