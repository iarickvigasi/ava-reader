"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

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
        className="relative w-full max-w-lg rounded-3xl bg-paper p-6 shadow-2xl"
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
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center rounded-[11px] bg-brand-fill px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-fill-strong"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
