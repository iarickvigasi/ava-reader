import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

// An import has one immutable identity and one terminal result. Omitted older
// payload fields and slower requests must not turn a saved book back into a job.
export function mergePdfImportStatus(
  prior: PdfImportSummary | null | undefined,
  next: PdfImportSummary | null | undefined,
): PdfImportSummary | null | undefined {
  if (!prior) return next;
  if (!next || prior.operationId !== next.operationId) return prior;
  if (prior.libraryItemId !== next.libraryItemId) return prior;
  if (
    next.generation < prior.generation ||
    Date.parse(next.updatedAt) < Date.parse(prior.updatedAt)
  )
    return prior;
  if (prior.failureId && next.failureId !== prior.failureId) return prior;
  if (
    next.generation === prior.generation &&
    prior.status === "WAITING" &&
    (next.status === "RUNNING" || next.status === "QUEUED")
  )
    return prior;
  if (prior.finalContentId && next.finalContentId !== prior.finalContentId)
    return prior;
  if (
    ["READY", "FAILED"].includes(prior.status) &&
    next.status !== prior.status
  )
    return prior;
  return next;
}
