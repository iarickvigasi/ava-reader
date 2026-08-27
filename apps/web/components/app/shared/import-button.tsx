"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadIcon } from "@/components/app/shared/app-icons";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { useImportUpload } from "@/components/app/shared/use-import-upload";
import { cn } from "@/lib/cn";

type ImportButtonProps = {
  className?: string;
  hideNotice?: boolean;
  label?: string;
  notice?: string | null;
  onNoticeChangeAction?: (notice: string | null) => void;
  variant?: "primary" | "soft" | "ghost" | "icon";
};

const styles = {
  ghost:
    "bg-white/40 text-ink hover:bg-white/70",
  icon:
    "size-11 rounded-control bg-white/55 text-ink hover:bg-white",
  primary:
    "bg-brand-fill text-brand-foreground shadow-(--shadow-card) hover:bg-brand-fill-strong",
  soft:
    "bg-soft-fill text-soft-foreground hover:bg-soft-tone-fill",
} as const;

export function ImportButton({
  className,
  hideNotice = false,
  label,
  notice,
  onNoticeChangeAction,
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
          "inline-flex items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60",
          variant === "icon" ? styles.icon : styles[variant],
          variant === "icon" ? "" : "min-h-12",
          className,
        )}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {variant === "icon" ? (
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
