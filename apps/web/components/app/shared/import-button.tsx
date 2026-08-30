"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadIcon } from "@/components/app/shared/app-icons";
import { PendingLabel } from "@/components/app/shared/pending-label";
import {
  importButtonBase,
  importButtonSizes,
  importButtonVariants,
  type ImportButtonSize,
  type ImportButtonVariant,
} from "@/components/app/shared/import-button-styles";
import { useImportUpload } from "@/components/app/shared/use-import-upload";
import { cn } from "@/lib/cn";

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

  const { isUploading, upload } = useImportUpload({ onNotice: publishNotice });
  const resolvedNotice = notice ?? internalNotice;
  const resolvedLabel = label ?? t("defaultLabel");
  const isIcon = variant === "icon";

  return (
    <div className="flex min-w-0 flex-col gap-2">
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

          upload(file);
        }}
      />

      <button
        type="button"
        className={cn(
          importButtonBase,
          importButtonVariants[variant],
          isIcon ? "" : importButtonSizes[size],
          className,
        )}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isIcon ? (
          <>
            <UploadIcon className="size-5 shrink-0" />
            <span className="sr-only">{resolvedLabel}</span>
          </>
        ) : (
          <PendingLabel pending={isUploading} pendingText={t("uploading")}>
            <UploadIcon className="size-4 shrink-0" />
            {resolvedLabel}
          </PendingLabel>
        )}
      </button>

      {!hideNotice && resolvedNotice ? (
        <p className="truncate text-xs tracking-[0.08em] text-muted">{resolvedNotice}</p>
      ) : null}
    </div>
  );
}
