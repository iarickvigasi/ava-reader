import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function readPdfImportStatus(value: unknown): PdfImportSummary | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<PdfImportSummary>;
  if (
    typeof s.operationId !== "string" ||
    typeof s.libraryItemId !== "string" ||
    typeof s.sourceArtifactId !== "string" ||
    typeof s.stage !== "string" ||
    !["QUEUED", "RUNNING", "WAITING", "READY", "FAILED", "STOPPED"].includes(
      s.status ?? "",
    ) ||
    !Number.isSafeInteger(s.generation) ||
    (s.generation ?? 0) < 1 ||
    typeof s.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(s.updatedAt)) ||
    !(s.finalContentId === null || typeof s.finalContentId === "string") ||
    !(s.failureId === null || typeof s.failureId === "string") ||
    typeof s.investigationRecorded !== "boolean"
  )
    return null;
  const progress = s.progress;
  if (
    progress !== null &&
    (!progress ||
      !Number.isSafeInteger(progress.completed) ||
      !Number.isSafeInteger(progress.total) ||
      progress.completed < 0 ||
      progress.total < progress.completed)
  )
    return null;
  if (s.status === "READY" && !s.finalContentId) return null;
  return s as PdfImportSummary;
}
