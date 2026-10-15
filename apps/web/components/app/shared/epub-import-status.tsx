"use client";

import { useTranslations } from "next-intl";
import type { EpubImportSummary } from "@/lib/api-types/epub-import";

export function EpubImportStatus({
  status,
}: {
  status?: EpubImportSummary | null;
}) {
  const t = useTranslations("epubImport");
  if (!status || (status.status === "READY" && status.finalContentId))
    return null;
  const failed = status.status === "FAILED";
  return (
    <p
      role="status"
      className={`text-sm ${failed ? "text-danger" : "text-muted"}`}
    >
      {t(failed ? "failed" : "preparing")}
    </p>
  );
}
