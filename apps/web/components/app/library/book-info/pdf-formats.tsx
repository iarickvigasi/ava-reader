"use client";
import { useTranslations } from "next-intl";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { Button } from "@/components/ui/button";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useFormatDownload } from "@/features/library/pdf-imports/use-format-download";
import { isPdfReadable } from "@/features/library/pdf-imports/is-readable";

export function PdfFormats({
  status,
  title,
}: {
  status: PdfImportSummary;
  title: string;
}) {
  const t = useTranslations("pdfImport");
  const online = useNetworkState();
  const { download, pending, failed } = useFormatDownload(status, title);
  return (
    <section className="space-y-3" aria-label={t("formats")}>
      <h2 className="font-ui text-xs uppercase tracking-[0.16em] text-muted">
        {t("formats")}
      </h2>
      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          variant="soft"
          disabled={!online || pending}
          onClick={() => void download("pdf")}
        >
          {t("originalPdf")}
        </Button>
        <Button
          size="sm"
          variant="soft"
          disabled={!online || pending || !isPdfReadable(status)}
          onClick={() => void download("epub")}
        >
          EPUB
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          {t("downloadFailed")}
        </p>
      )}
    </section>
  );
}
