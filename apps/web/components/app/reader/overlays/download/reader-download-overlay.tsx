import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useBookDownload } from "@/features/library/downloads/use-book-download";
import type { ReaderBookPayload } from "@/lib/api-types/reader";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { restoreControlFocus } from "../restore-control-focus";

export function ReaderDownloadOverlay({
  book,
  onClose,
}: {
  book: ReaderBookPayload;
  onClose: () => void;
}) {
  const t = useTranslations("reader.download");
  const pdf = useTranslations("pdfImport");
  const online = useNetworkState();
  const { download, pending, failed } = useBookDownload(
    book.libraryItemId,
    book.title,
  );
  const close = useRef<HTMLButtonElement>(null);
  useCloseOnEscape(onClose);
  useEffect(() => {
    const origin = document.activeElement;
    const path = window.location.pathname;
    close.current?.focus();
    return () => {
      restoreControlFocus(origin, path, "[data-reader-download-control]");
    };
  }, []);
  const available =
    book.primaryFormat === "EPUB" || book.primaryFormat === "PDF";
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t("close")}
        className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
        onClick={onClose}
      />
      <aside
        aria-label={t("title")}
        className="pointer-events-auto absolute inset-y-0 left-0 flex w-full max-w-96 flex-col bg-paper/95 px-6 py-8 shadow-lg backdrop-blur-sm md:w-94 md:pt-24"
      >
        <div className="flex items-center justify-between gap-4">
          <PanelTitle>{t("title")}</PanelTitle>
          <button
            ref={close}
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="size-11 shrink-0 rounded-control text-xl text-ink hover:bg-soft-tone-fill focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            ×
          </button>
        </div>
        <p className="mt-4 break-words font-reader text-copy">{book.title}</p>
        <div className="mt-6 flex flex-wrap gap-3" aria-busy={pending}>
          {available && (
            <Button
              variant="soft"
              disabled={!online || pending}
              onClick={() => void download("epub")}
            >
              EPUB
            </Button>
          )}
          {book.primaryFormat === "PDF" && (
            <Button
              variant="soft"
              disabled={!online || pending}
              onClick={() => void download("pdf")}
            >
              {pdf("originalPdf")}
            </Button>
          )}
        </div>
        {!available && (
          <p className="mt-4 text-sm text-muted">{t("unavailable")}</p>
        )}
        {!online && (
          <p role="status" className="mt-4 text-sm text-muted">
            {t("offline")}
          </p>
        )}
        {pending && (
          <p role="status" className="mt-4 text-sm text-muted">
            {t("pending")}
          </p>
        )}
        {failed && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {pdf("downloadFailed")}
          </p>
        )}
      </aside>
    </div>
  );
}
