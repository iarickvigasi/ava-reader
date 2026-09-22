import type { ReactNode, TouchEventHandler } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { cn } from "@/lib/cn";

export function ReaderPageViewport({
  children,
  onTouchStart,
  onTouchEnd,
  embedded = false,
}: {
  children: ReactNode;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  embedded?: boolean;
}) {
  const { isPhone } = useReaderUi();
  // Keep ink bleed inside the page margin while clipping neighbouring columns.
  return (
    <div
      data-reader-page-viewport
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden",
        !embedded && "px-3 py-2",
        !embedded && !isPhone && "sm:px-5 sm:py-6 md:px-6",
      )}
      style={{ touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
