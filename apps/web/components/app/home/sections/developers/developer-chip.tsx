"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DeveloperContact } from "@/lib/api-types/home";

export function DeveloperChip({ developer }: { developer: DeveloperContact }) {
  const t = useTranslations("home.developers");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <a
      href={developer.telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("message", { name: developer.displayName })}
      className="inline-flex min-h-13 max-w-full items-center gap-3 rounded-control bg-soft-fill px-4 py-3 text-soft-foreground transition duration-200 hover:bg-soft-tone-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-fill text-brand-foreground"
        aria-hidden="true"
      >
        {developer.avatarUrl && failedSrc !== developer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={developer.avatarUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setFailedSrc(developer.avatarUrl)}
          />
        ) : (
          developer.displayName.charAt(0).toUpperCase()
        )}
      </span>
      <span className="min-w-0 break-words text-lg font-medium">
        {developer.displayName}
      </span>
    </a>
  );
}
