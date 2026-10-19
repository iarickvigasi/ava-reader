"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useBookDownload } from "@/features/library/downloads/use-book-download";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function EpubSourceDownload({
  libraryItemId,
  title,
}: {
  libraryItemId: string;
  title: string;
}) {
  const t = useTranslations("epubImport");
  const error = useTranslations("pdfImport");
  const online = useNetworkState();
  const { download, pending, failed } = useBookDownload(libraryItemId, title);
  return (
    <div className="space-y-2" aria-busy={pending}>
      <Button
        size="sm"
        variant="soft"
        disabled={!online || pending}
        onClick={() => void download("epub")}
      >
        {t("original")}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          {error("downloadFailed")}
        </p>
      )}
    </div>
  );
}
