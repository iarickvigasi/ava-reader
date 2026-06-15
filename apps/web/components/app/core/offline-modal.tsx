"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { useOfflineModal } from "./offline-modal-context";

export function OfflineModal() {
  const { isOpen, close } = useOfflineModal();
  const t = useTranslations("offline.modal");

  // Close on Escape — mirrors what the other modals in the app do.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-lg rounded-modal bg-paper p-6 shadow-(--shadow-card)"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="offline-modal-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">
          {t("body")}
        </p>
        <div className="mt-6 flex justify-end">
          <Button type="button" size="sm" onClick={close}>
            {t("dismiss")}
          </Button>
        </div>
      </div>
    </div>
  );
}
