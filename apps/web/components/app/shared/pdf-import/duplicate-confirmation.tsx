"use client";
import { useId } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";

export function PdfDuplicateConfirmation({
  filename,
  existingHref,
  onClose,
  onCopy,
}: {
  filename: string;
  existingHref: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations("pdfImport"),
    titleId = useId();
  return (
    <ModalShell labelledBy={titleId} onClose={onClose} maxWidth="md">
      <div className="space-y-6 rounded-modal bg-surface p-6 text-ink shadow-(--shadow-card)">
        <div className="space-y-2">
          <h2 id={titleId} className="font-reader text-2xl text-title">
            {t("duplicateTitle")}
          </h2>
          <p className="break-words text-sm text-muted">{filename}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Link
            href={existingHref}
            onClick={onClose}
            className="text-sm underline underline-offset-4"
          >
            {t("openExisting")}
          </Link>
          <Button size="sm" onClick={onCopy}>
            {t("addCopy")}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
