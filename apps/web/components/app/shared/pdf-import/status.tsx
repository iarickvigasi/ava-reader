"use client";
import { useTranslations } from "next-intl";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { usePdfStatusFreshness } from "@/features/library/pdf-imports/use-status-freshness";

export function PdfImportStatus({
  status,
  details = false,
}: {
  status?: PdfImportSummary | null;
  details?: boolean;
}) {
  const t = useTranslations("pdfImport");
  const fresh = usePdfStatusFreshness();
  if (!status) return null;
  const state =
    status.status === "READY" && !status.finalContentId
      ? "WAITING"
      : status.status;
  return (
    <div
      role={details ? "status" : undefined}
      className="space-y-1 text-sm text-muted"
    >
      <p className={state === "FAILED" ? "text-danger" : undefined}>
        {t(`status.${state}`)}
        {!fresh ? ` · ${t("lastKnown")}` : ""}
      </p>
      {details && state === "RUNNING" && status.progress && (
        <p>
          {t("progress", {
            completed: status.progress.completed,
            total: status.progress.total,
          })}
        </p>
      )}
      {details && state === "FAILED" && (
        <>
          {status.investigationRecorded && <p>{t("investigating")}</p>}
          {status.failureId && (
            <p className="break-all">
              {t("reference", { id: status.failureId })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
