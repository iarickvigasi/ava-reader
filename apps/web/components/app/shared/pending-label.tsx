import type { ReactNode } from "react";

import { DotPulseIcon } from "@/components/app/shared/dot-pulse-icon";
import { cn } from "@/lib/cn";

// Label swap for controls that fire a slow action (docs/styles.md §Buttons).
// Both layers stay mounted in one grid cell so the control's width never
// shifts; the layer that is invisible is also aria-hidden. Both fades wait
// 150ms, so an action that completes sooner never repaints the label at all.
// The pending layer reads as "<text>…": the dots trail the text and the
// baseline alignment drops them to the bottom, like an animated ellipsis.
const layer =
  "col-start-1 row-start-1 inline-flex justify-center transition-opacity duration-200";

type PendingLabelProps = {
  pending: boolean;
  pendingText: string;
  children: ReactNode;
};

export function PendingLabel({
  pending,
  pendingText,
  children,
}: PendingLabelProps) {
  return (
    <span aria-busy={pending} className="inline-grid place-items-center">
      <span
        aria-hidden={pending || undefined}
        className={cn(
          layer,
          "items-center gap-2",
          pending ? "opacity-0 delay-150" : "opacity-100",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden={!pending || undefined}
        className={cn(
          layer,
          "items-baseline gap-0.5",
          pending ? "opacity-100 delay-150" : "opacity-0",
        )}
      >
        {pendingText}
        <DotPulseIcon />
      </span>
    </span>
  );
}
