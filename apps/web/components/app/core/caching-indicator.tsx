"use client";

// Non-interactive header pill for the background primer's progress (see
// [[4.4-cache-priming]]). Sibling to OfflineIndicator; HeaderStatusChip shows
// exactly one of them inside a slot that reserves space even while idle:
//   - caching → content tier, "Caching for offline access n/m books"
//   - ready   → brief "Ready for offline work" confirmation on first completion
// The dot pulses while work is active (the offline chip's is deliberately
// static); ready swaps it for a static check. The accessible name is the static
// phrase only — the live count is aria-hidden so a screen reader announces it
// once instead of on every book.

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";
import styles from "./status-chip.module.css";

type Progress = { done: number; total: number };

export type PrimeChipState = ({ kind: "caching" } & Progress) | { kind: "ready" };

type CachingIndicatorProps = {
  state: PrimeChipState;
  // Compact = numeric progress or a short localized ready label.
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
};

export function CachingIndicator({
  state,
  compact = false,
  iconOnly = false,
  className,
}: CachingIndicatorProps) {
  const t = useTranslations("offline");

  const phrase = state.kind === "ready" ? t("readyStatus") : t("cachingStatus");
  const count =
    state.kind === "ready"
      ? null
      : t("cachingCount", { done: state.done, total: state.total });
  const icon = state.kind === "ready" ? <ReadyCheck /> : <CachingDot />;
  const fullLabel = count ? `${phrase} ${count}` : phrase;
  const label = compact
    ? state.kind === "ready"
      ? t("readyCompactStatus")
      : `${state.done}/${state.total}`
    : fullLabel;

  return (
    <span
      role="status"
      aria-label={phrase}
      title={fullLabel}
      className={cn(
        styles.pill,
        compact && styles.compactPill,
        iconOnly && styles.iconOnlyPill,
        "rounded-full bg-soft-fill font-semibold uppercase text-copy-strong",
        className,
      )}
    >
      {icon}
      <span aria-hidden className={styles.label}>{label}</span>
    </span>
  );
}

function CachingDot() {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-brand-fill"
    />
  );
}

function ReadyCheck() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 shrink-0 text-brand-fill"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6.5 5 9l4.5-5" />
    </svg>
  );
}
