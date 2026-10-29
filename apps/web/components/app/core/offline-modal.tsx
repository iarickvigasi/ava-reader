"use client";

import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useOfflineModal } from "./offline-modal-context";

export function OfflineModal() {
  const { isOpen, reason, close } = useOfflineModal();
  const t = useTranslations("offline.modal");
  const titleKey = reason === "slow" ? "slowTitle" : "title";
  const bodyKey = reason === "slow" ? "slowBody" : "body";

  if (!isOpen) {
    return null;
  }

  return (
    <ModalShell labelledBy="offline-modal-title" onClose={close}>
      <div className="relative w-full max-w-lg rounded-modal bg-paper p-6 shadow-(--shadow-card)">
        <h2
          id="offline-modal-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t(titleKey)}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">{t(bodyKey)}</p>
        <div className="mt-6 flex justify-end">
          <Button type="button" size="sm" onClick={close}>
            {t("dismiss")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
