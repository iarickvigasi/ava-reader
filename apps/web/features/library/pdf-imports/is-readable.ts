import type { PdfImportSummary } from "@/lib/api-types/pdf-import";

export function isPdfReadable(status?: PdfImportSummary | null) {
  return (
    !status || (status.status === "READY" && Boolean(status.finalContentId))
  );
}
