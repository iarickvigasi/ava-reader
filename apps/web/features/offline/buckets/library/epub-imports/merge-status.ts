import type { EpubImportSummary } from "@/lib/api-types/epub-import";

// Missing legacy fields cannot erase known preparation. Older snapshots cannot
// overwrite a terminal result or the metadata belonging to that result.
export function mergeEpubImportStatus(
  prior: EpubImportSummary | null | undefined,
  next: EpubImportSummary | null | undefined,
) {
  if (!prior) return next;
  if (!next || (prior.runId && prior.runId !== next.runId)) return prior;
  if (
    prior.updatedAt &&
    (!next.updatedAt ||
      Date.parse(next.updatedAt) < Date.parse(prior.updatedAt))
  )
    return prior;
  if (
    prior.status === "READY" &&
    next.status === "FAILED" &&
    next.updatedAt &&
    prior.updatedAt &&
    Date.parse(next.updatedAt) > Date.parse(prior.updatedAt)
  )
    return next;
  if (prior.finalContentId && prior.finalContentId !== next.finalContentId)
    return prior;
  if (
    ["READY", "FAILED"].includes(prior.status) &&
    next.status !== prior.status
  )
    return prior;
  return next;
}

export function epubDetailsRevision(status?: EpubImportSummary | null) {
  return status
    ? JSON.stringify([status.runId, status.status, status.finalContentId])
    : undefined;
}
