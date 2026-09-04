"use client";

// Compact "Offline" pill rendered in the page header (web) and in the reader
// header (web + mobile). Reads from the offline net-state store; renders
// nothing while online. Clicking opens the offline modal — the same one that
// auto-shows on app open offline / connection drop. Pill markup is shared
// with SlowConnectionIndicator via StatusPill.

import { useTranslations } from "next-intl";

import { useNetworkState } from "@/features/offline/net/use-network-state";

import { useOfflineModal } from "./offline-modal-context";
import { StatusPill } from "./status-pill";

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

  return (
    <StatusPill
      label={t("chip")}
      ariaLabel={t("chipAria")}
      dotClassName="bg-muted"
      compact={compact}
      className={className}
      onClick={() => open("offline")}
    />
  );
}
