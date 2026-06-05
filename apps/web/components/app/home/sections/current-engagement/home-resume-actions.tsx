"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReadBookLink } from "@/components/app/core/read-book-link";
import { ImportButton } from "@/components/app/shared/import-button";

type HomeResumeActionsProps = {
  readerHref: string;
  libraryItemId: string;
};

export function HomeResumeActions({
  readerHref,
  libraryItemId,
}: HomeResumeActionsProps) {
  const t = useTranslations("home.engagement");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="hidden md:flex md:flex-col md:items-start md:gap-2">
      <div className="flex items-center gap-3">
        <ReadBookLink
          href={readerHref}
          libraryItemId={libraryItemId}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-brand-fill bg-brand-fill px-5 text-sm font-semibold uppercase tracking-[0.14em] text-brand-foreground shadow-(--shadow-card) transition hover:bg-brand-fill-strong"
        >
          {t("resumeReading")}
        </ReadBookLink>
        <ImportButton
          variant="soft"
          label={t("importAnother")}
          hideNotice
          notice={notice}
          onNoticeChangeAction={setNotice}
        />
      </div>
      {notice ? <p className="text-xs tracking-[0.08em] text-muted">{notice}</p> : null}
    </div>
  );
}
