"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/app/library/collection/collection-actions/modal-shell";

export function PdfImportConfirmation({
  filename,
  onClose,
  onConfirm,
}: {
  filename: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("pdfImport");
  const titleId = useId();
  const [convert, setConvert] = useState(false);
  return (
    <ModalShell labelledBy={titleId} onClose={onClose} maxWidth="md">
      <form
        className="space-y-6 rounded-modal bg-surface p-6 text-ink shadow-(--shadow-card)"
        onSubmit={(event) => {
          event.preventDefault();
          if (convert) onConfirm();
        }}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="font-reader text-2xl text-title">
            {t("title")}
          </h2>
          <p className="break-words text-sm text-muted">{filename}</p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={convert}
            onChange={(event) => setConvert(event.target.checked)}
            className="size-5 accent-brand-fill focus-visible:outline-2 focus-visible:outline-offset-4"
          />
          {t("convert")}
        </label>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">{t("processingDetails")}</summary>
          <p className="mt-2 text-copy">{t("privacy")}</p>
        </details>
        <div className="flex justify-end gap-3">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={!convert}>
            {t("import")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
