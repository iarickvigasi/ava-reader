"use client";

// Compact "Slow" pill — the online-but-degraded counterpart to
// OfflineIndicator (spec 4.10-slow-connection). Renders nothing while
// offline (the Offline chip wins outright) or while the connection isn't
// currently flagged slow. Clicking opens the same offline modal, adapted
// copy via `reason: "slow"`.

import { useTranslations } from "next-intl";

import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useSlowState } from "@/features/offline/net/use-slow-state";

import { useOfflineModal } from "./offline-modal-context";
import { StatusPill } from "./status-pill";

type SlowConnectionIndicatorProps = {
  compact?: boolean;
  className?: string;
};

export function SlowConnectionIndicator({
  compact = false,
  className,
}: SlowConnectionIndicatorProps) {
  const online = useNetworkState();
  const slow = useSlowState();
  const t = useTranslations("offline");
  const { open } = useOfflineModal();

  if (!online || !slow) {
    return null;
  }

  return (
    <StatusPill
      label={t("slowChip")}
      ariaLabel={t("slowChipAria")}
      dotClassName="bg-warning"
      compact={compact}
      className={className}
      onClick={() => open("slow")}
    />
  );
}
