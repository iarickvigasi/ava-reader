"use client";

// The single header status slot: renders the Offline chip, the priming-progress
// chip, or nothing — exactly one at a time (see [[11-cache-priming]]). Offline
// wins over priming. Drop-in replacement for the old direct <OfflineIndicator/>
// mounts in the page + reader headers.

import { useHeaderChip } from "@/features/offline/status/use-header-chip";

import { CachingIndicator } from "./caching-indicator";
import { OfflineIndicator } from "./offline-indicator";

type HeaderStatusChipProps = {
  compact?: boolean;
  className?: string;
};

export function HeaderStatusChip({
  compact = false,
  className,
}: HeaderStatusChipProps) {
  const chip = useHeaderChip();

  if (chip.kind === "offline") {
    return <OfflineIndicator compact={compact} className={className} />;
  }
  if (chip.kind === "none") {
    return null;
  }
  // caching | ready — one pill.
  const state =
    chip.kind === "ready"
      ? ({ kind: "ready" } as const)
      : ({ kind: chip.kind, done: chip.done, total: chip.total } as const);
  return (
    <CachingIndicator state={state} compact={compact} className={className} />
  );
}
