"use client";

// Save-Data consent modal for the heavy content tier of the cache primer. Shown
// only when the user is on a Data Saver connection and hasn't yet answered.
// Confirm → download offline-marked books; cancel → skip (remembered). Styled to
// match the app's other dialogs (see components/app/core/offline-modal.tsx).

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function PrimeConsentModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("offline.primeConsent");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prime-consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-lg rounded-modal bg-paper p-6 shadow-(--shadow-card)"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="prime-consent-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">{t("body")}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
