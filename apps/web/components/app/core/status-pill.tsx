"use client";

// Shared markup for a compact header status pill (dot + label, tappable) —
// used by OfflineIndicator and SlowConnectionIndicator so the two states
// share one look and only differ in color/label/action.

import { cn } from "@/lib/cn";
import styles from "./status-chip.module.css";

type StatusPillProps = {
  label: string;
  ariaLabel: string;
  // Tailwind color utility for the dot, e.g. "bg-muted" or "bg-warning".
  dotClassName: string;
  // Compact labels collapse to the dot when their status slot is too narrow.
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
  onClick: () => void;
};

export function StatusPill({
  label,
  ariaLabel,
  dotClassName,
  compact = false,
  iconOnly = false,
  className,
  onClick,
}: StatusPillProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={cn(
        styles.pill,
        compact && styles.compactPill,
        iconOnly && styles.iconOnlyPill,
        "rounded-full bg-soft-fill font-semibold uppercase text-copy-strong transition hover:bg-paper-strong",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("inline-block size-2 shrink-0 rounded-full", dotClassName)}
      />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
