"use client";

// Non-interactive header pill for the background primer's progress (see
// [[11-cache-priming]]). Sibling to OfflineIndicator; HeaderStatusChip shows
// exactly one of them. Two states share one pill so its reserved height never
// reflows the header:
//   - caching → content tier, "Caching for offline access n/m books"
//   - ready   → brief "Ready for offline work" confirmation on first completion
// The dot pulses while work is active (the offline chip's is deliberately
// static); ready swaps it for a static check. The accessible name is the static
// phrase only — the live count is aria-hidden so a screen reader announces it
// once instead of on every book.

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

type Progress = { done: number; total: number };

export type PrimeChipState = ({ kind: "caching" } & Progress) | { kind: "ready" };

type CachingIndicatorProps = {
  state: PrimeChipState;
  // Compact = count-only pill for space-tight mobile/reader headers.
  compact?: boolean;
  className?: string;
};

export function CachingIndicator({
  state,
  compact = false,
  className,
}: CachingIndicatorProps) {
  const t = useTranslations("offline");

  const phrase = state.kind === "ready" ? t("readyStatus") : t("cachingStatus");
  const count =
    state.kind === "ready"
      ? null
      : t("cachingCount", { done: state.done, total: state.total });
  const icon = state.kind === "ready" ? <ReadyCheck /> : <CachingDot />;

  return (
    <span
      role="status"
      aria-label={phrase}
      className={cn(
        compact
          ? "inline-flex h-7 items-center gap-1.5 rounded-full bg-soft-fill px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-copy-strong"
          : "inline-flex h-9 items-center gap-2 rounded-full bg-soft-fill px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-copy-strong",
        className,
      )}
    >
      {icon}
      {/* Compact: count only (ready falls back to the phrase). Full: phrase + count. */}
      <span aria-hidden>
        {compact
          ? (count ?? phrase)
          : count
            ? `${phrase} ${count}`
            : phrase}
      </span>
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
