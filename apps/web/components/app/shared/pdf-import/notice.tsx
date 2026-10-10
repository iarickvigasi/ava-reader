"use client";
import { useEffect } from "react";
import Link from "next/link";
import { getLibraryBookInfoHref } from "@/lib/app-routes";
import { useTranslations } from "next-intl";
import { usePdfNotices } from "@/features/offline/buckets/library";

export function PdfImportNotice() {
  const t = useTranslations("pdfImport");
  const { notices, mark } = usePdfNotices();
  const notice = notices[0];
  useEffect(() => {
    if (!notice || notice.deliveredAt || document.visibilityState === "hidden")
      return;
    void mark(notice.id, "delivered");
  }, [notice, mark]);
  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-line bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--copy-strong)] shadow-lg md:bottom-6"
    >
      <Link
        href={getLibraryBookInfoHref(encodeURIComponent(notice.slug))}
        className="min-w-0 flex-1 break-words underline underline-offset-4"
      >
        {t(
          notice.kind === "pdf_import_ready" ? "readyNotice" : "failedNotice",
          { title: notice.title },
        )}
      </Link>
      <button
        type="button"
        onClick={() => void mark(notice.id, "acknowledged")}
        className="shrink-0 rounded-lg px-3 py-2"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
