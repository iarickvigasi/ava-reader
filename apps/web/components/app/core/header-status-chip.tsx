"use client";

// One reserved header slot across Offline, Slow, priming, ready, and idle.
// Keeping the empty slot prevents status changes from moving nearby controls.

import { useHeaderChip } from "@/features/offline/status/use-header-chip";
import { cn } from "@/lib/cn";

import { CachingIndicator } from "./caching-indicator";
import { OfflineIndicator } from "./offline-indicator";
import { SlowConnectionIndicator } from "./slow-connection-indicator";
import styles from "./status-chip.module.css";

type HeaderStatusChipProps = {
  compact?: boolean;
  iconOnly?: boolean;
  // Applies to the reserved slot, including while no chip is visible.
  className?: string;
};

export function HeaderStatusChip({
  compact = false,
  iconOnly = false,
  className,
}: HeaderStatusChipProps) {
  const chip = useHeaderChip();
  const indicatorProps = { compact, iconOnly };
  let indicator = null;

  if (chip.kind === "offline") {
    indicator = <OfflineIndicator {...indicatorProps} />;
  } else if (chip.kind === "slow") {
    indicator = <SlowConnectionIndicator {...indicatorProps} />;
  } else if (chip.kind === "caching" || chip.kind === "ready") {
    indicator = <CachingIndicator state={chip} {...indicatorProps} />;
  }

  return (
    <span
      data-header-status={chip.kind}
      className={cn(
        styles.slot,
        compact && styles.compactSlot,
        iconOnly && styles.iconOnlySlot,
        className,
      )}
    >
      {indicator}
    </span>
  );
}
