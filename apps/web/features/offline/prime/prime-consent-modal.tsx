"use client";

// Save-Data consent modal for the heavy content tier of the cache primer. Shown
// only when the user is on a Data Saver connection and hasn't yet answered.
// Confirm → download offline-marked books; cancel → skip (remembered). Styled to
// match the app's other dialogs (see components/app/core/offline-modal.tsx).

import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";
import { useTranslations } from "next-intl";
import { ModalActions } from "@/components/ui/modal-actions";

import { Button } from "@/components/ui/button";

export function PrimeConsentModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("offline.primeConsent");

  return (
    <ModalShell labelledBy="prime-consent-title" onClose={onCancel}>
      <div className="relative w-full max-w-lg rounded-modal bg-paper p-6 shadow-(--shadow-card)">
        <h2
          id="prime-consent-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">{t("body")}</p>
        <ModalActions cancelLabel={t("cancel")} onCancel={onCancel}>
          <Button type="button" size="sm" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </ModalActions>
      </div>
    </ModalShell>
  );
}
