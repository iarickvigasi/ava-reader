"use client";

import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PendingLabel } from "@/components/app/shared/pending-label";

// Label for surfaces that navigate into the reader: swaps to "Opening…" +
// pulse dots while this link's navigation is pending (docs/styles.md
// §Buttons). useLinkStatus only reads from an enclosing <Link>, so render
// this inside a ReadBookLink, never standalone. The offline interception in
// ReadBookLink prevents the navigation, so no pending state flashes there.
export function ReadLinkOpeningLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  const t = useTranslations("shared.readLink");
  return (
    <PendingLabel pending={pending} pendingText={t("opening")}>
      {children}
    </PendingLabel>
  );
}
