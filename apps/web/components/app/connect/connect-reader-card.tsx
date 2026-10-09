"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PublishedReader } from "@/lib/api-types/published-reader";
import { readerInitials } from "@/features/connect/reader-initials";

export function ConnectReaderCard({ reader }: { reader: PublishedReader }) {
  const t = useTranslations("connect.discovery");
  const [imageFailed, setImageFailed] = useState(false);
  const name = reader.displayName || t("reader");
  return (
    <article className="connect-reader-card min-w-0 space-y-5 rounded-card bg-soft-fill p-6 sm:p-8">
      <div className="flex items-center gap-4">
        {reader.avatarUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reader.avatarUrl}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-soft-fill font-display text-2xl text-ink [[data-theme=dark]_&]:bg-sand"
          >
            {readerInitials(name)}
          </span>
        )}
        <h3 className="min-w-0 wrap-break-word font-display text-2xl text-title">
          {name}
        </h3>
      </div>
      <p className="whitespace-pre-wrap wrap-break-word text-lg leading-7 text-copy">
        {reader.introduction}
      </p>
      {reader.currentBook && (
        <div className="space-y-1 border-t border-line/30 pt-4">
          <p className="font-ui text-xs uppercase tracking-[0.16em] text-muted">
            {t("currentlyReading")}
          </p>
          <p className="wrap-break-word text-lg text-ink">
            {reader.currentBook.title}
            {reader.currentBook.authors.length > 0 && (
              <span className="text-sm text-copy">
                {" · "}
                {reader.currentBook.authors.join(", ")}
              </span>
            )}
          </p>
        </div>
      )}
    </article>
  );
}
