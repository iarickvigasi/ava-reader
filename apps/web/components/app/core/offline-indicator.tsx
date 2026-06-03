"use client";

// Compact "Offline" pill rendered in the page header (web) and in the reader
// header (web + mobile). Reads from the offline net-state store; renders
// nothing while online. Clicking opens the offline modal — the same one that
// auto-shows on app open offline / connection drop.

import { useTranslations } from "next-intl";

import { useNetworkState } from "@/features/offline/use-network-state";

import { useOfflineModal } from "./offline-modal-context";

type OfflineIndicatorProps = {
  // Compact = icon-only with dot. Used in the mobile reader where horizontal
  // space is tight.
  compact?: boolean;
  className?: string;
};

export function OfflineIndicator({
  compact = false,
  className,
}: OfflineIndicatorProps) {
  const online = useNetworkState();
  const t = useTranslations("offline");
  const { open } = useOfflineModal();

  if (online) {
    return null;
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={t("chipAria")}
        onClick={open}
        className={cx(
          "inline-flex h-7 items-center gap-1.5 rounded-full bg-soft-fill px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-copy-strong",
          className,
        )}
      >
        <OfflineDot />
        <span>{t("chip")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={t("chipAria")}
      onClick={open}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-full bg-soft-fill px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-copy-strong transition hover:bg-paper-strong",
        className,
      )}
    >
      <OfflineDot />
      <span>{t("chip")}</span>
    </button>
  );
}

function OfflineDot() {
  // Static dot (no pulse animation) — being offline is a steady state, not
  // a "we're trying" state. A pulse here would feel like "syncing".
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full bg-muted"
    />
  );
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
