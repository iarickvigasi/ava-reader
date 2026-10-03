"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  type ImportButtonSize,
  type ImportButtonVariant,
} from "@/components/app/shared/import-button-styles";
import { useImportUpload } from "@/components/app/shared/use-import-upload";
import { useImportChoice } from "@/features/library/pdf-imports/use-import-choice";
import { PdfImportConfirmation } from "./pdf-import/confirmation";
import { ImportTrigger } from "./import-trigger";

type ImportButtonProps = {
  className?: string;
  hideNotice?: boolean;
  label?: string;
  notice?: string | null;
  onNoticeChangeAction?: (notice: string | null) => void;
  size?: ImportButtonSize;
  variant?: ImportButtonVariant;
};

export function ImportButton({
  className,
  hideNotice = false,
  label,
  notice,
  onNoticeChangeAction,
  size = "md",
  variant = "primary",
}: ImportButtonProps) {
  const t = useTranslations("shared.import");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [internalNotice, setInternalNotice] = useState<string | null>(null);

  function publishNotice(nextNotice: string | null) {
    setInternalNotice(nextNotice);
    onNoticeChangeAction?.(nextNotice);
  }

  const { isUploading, upload } = useImportUpload({
    onNoticeAction: publishNotice,
  });
  const choice = useImportChoice(upload);
  const resolvedNotice = notice ?? internalNotice;
  const resolvedLabel = label ?? t("defaultLabel");

  return (
    <div className="relative flex min-w-0 flex-col">
      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (!file) {
            return;
          }

          choice.choose(file);
        }}
      />

      <ImportTrigger
        className={className}
        variant={variant}
        size={size}
        label={resolvedLabel}
        pending={isUploading}
        onClick={() => inputRef.current?.click()}
      />

      {!hideNotice && resolvedNotice ? (
        <p
          role="status"
          className="absolute left-0 right-0 top-full mt-2 truncate text-xs tracking-[0.08em] text-muted"
        >
          {resolvedNotice}
        </p>
      ) : null}
      {choice.pdf && (
        <PdfImportConfirmation
          filename={choice.pdf.name}
          onClose={choice.dismiss}
          onConfirm={choice.confirm}
        />
      )}
    </div>
  );
}
