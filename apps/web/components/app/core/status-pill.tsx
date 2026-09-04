"use client";

// Shared markup for a compact header status pill (dot + label, tappable) —
// used by OfflineIndicator and SlowConnectionIndicator so the two states
// share one look and only differ in color/label/action.

type StatusPillProps = {
  label: string;
  ariaLabel: string;
  // Tailwind color utility for the dot, e.g. "bg-muted" or "bg-warning".
  dotClassName: string;
  // Compact = icon-only with dot. Used in the mobile reader where horizontal
  // space is tight.
  compact?: boolean;
  className?: string;
  onClick: () => void;
};

export function StatusPill({
  label,
  ariaLabel,
  dotClassName,
  compact = false,
  className,
  onClick,
}: StatusPillProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cx(
        compact
          ? "inline-flex h-7 items-center gap-1.5 rounded-full bg-soft-fill px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-copy-strong"
          : "inline-flex h-9 items-center gap-2 rounded-full bg-soft-fill px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-copy-strong transition hover:bg-paper-strong",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx("inline-block size-2 shrink-0 rounded-full", dotClassName)}
      />
      <span>{label}</span>
    </button>
  );
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
