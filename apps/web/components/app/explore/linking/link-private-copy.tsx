"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useWorkCopies } from "@/features/offline/buckets/library";
import { getReaderHref } from "@/lib/app-routes";
import { useState } from "react";
import { ActionCard } from "@/components/app/library/book-info/action-card";
import { ExploreBoldIcon } from "@/components/app/library/book-info/explore-bold-icon";
import type { CatalogWork } from "@/lib/catalog-types";
import { PrivateLinkDialog } from "./private-link-dialog";
export function LinkPrivateCopy({ work }: { work: CatalogWork }) {
  const t = useTranslations("library.bookInfo.actionCards.catalogLink");
  const [open, setOpen] = useState(false);
  const copies = useWorkCopies(work.id);
  return (
    <div className="space-y-3">
      {copies.map((copy) => (
        <Link
          key={copy.libraryItemId}
          href={getReaderHref(copy.slug)}
          className="text-plum underline"
        >
          {t("readCopy", { title: copy.title })}
        </Link>
      ))}
      <ActionCard
        icon={ExploreBoldIcon}
        title={t("uploadTitle")}
        description={t("privacy")}
        onClick={() => setOpen(true)}
      />
      {open && <PrivateLinkDialog work={work} close={() => setOpen(false)} />}
    </div>
  );
}
