"use client";

import { useRef, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UploadIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";

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
    "border border-line bg-white/40 text-ink hover:bg-white/70",
  icon:
    "size-11 rounded-[14px] border border-line bg-white/55 text-ink hover:bg-white",
  primary:
    "border border-brand-fill bg-brand-fill text-brand-foreground shadow-[var(--shadow-card)] hover:bg-brand-fill-strong",
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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [internalNotice, setInternalNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const resolvedNotice = notice ?? internalNotice;
  const resolvedLabel = label ?? t("defaultLabel");

  function publishNotice(nextNotice: string | null) {
    setInternalNotice(nextNotice);
    onNoticeChangeAction?.(nextNotice);
  }

  async function onFileSelected(file: File) {
    if (!isLoaded || !isSignedIn) {
      publishNotice(t("signIn"));
      return;
    }

    const token = await getToken();

    if (!token) {
      publishNotice(t("noToken"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${getPublicApiBaseUrl()}/api/library/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      publishNotice(payload?.message ?? t("uploadFailed"));
      return;
    }

    publishNotice(t("imported", { filename: file.name }));
    router.refresh();
  }

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

          startTransition(() => {
            void onFileSelected(file);
          });
        }}
      />

      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60",
          variant === "icon" ? styles.icon : styles[variant],
          variant === "icon" ? "" : "min-h-12",
          className,
        )}
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className={cn("shrink-0", variant === "icon" ? "size-5" : "size-4")} />
        {variant === "icon" ? <span className="sr-only">{resolvedLabel}</span> : isPending ? t("uploading") : resolvedLabel}
      </button>

      {!hideNotice && resolvedNotice ? (
        <p className="truncate text-xs tracking-[0.08em] text-muted">{resolvedNotice}</p>
      ) : null}
    </div>
  );
}
