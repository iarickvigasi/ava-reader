"use client";

// Non-interactive header pill shown while the background primer downloads the
// user's offline-marked books for offline use (see [[11-cache-priming]]).
// Sibling to OfflineIndicator; HeaderStatusChip shows exactly one of them. The
// dot pulses (the offline chip's is deliberately static) to read as active
// work. The accessible name is the static phrase only — the live count is
// aria-hidden so a screen reader announces it once instead of on every book.

import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

type CachingIndicatorProps = {
  done: number;
  total: number;
  // Compact = count-only pill for space-tight mobile/reader headers.
  compact?: boolean;
  className?: string;
};

export function CachingIndicator({
  done,
  total,
  compact = false,
  className,
}: CachingIndicatorProps) {
  const t = useTranslations("offline");
  const phrase = t("cachingStatus");
  const count = t("cachingCount", { done, total });

  if (compact) {
    return (
      <span
        role="status"
        aria-label={phrase}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full bg-soft-fill px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-copy-strong",
          className,
        )}
      >
        <CachingDot />
        <span aria-hidden>{count}</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={phrase}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full bg-soft-fill px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-copy-strong",
        className,
      )}
    >
      <CachingDot />
      <span aria-hidden>{`${phrase} ${count}`}</span>
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
