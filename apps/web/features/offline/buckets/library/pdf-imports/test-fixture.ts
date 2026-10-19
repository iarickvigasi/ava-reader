import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
export const pdfStatus: PdfImportSummary = {
  operationId: "operation",
  libraryItemId: "lib-1",
  sourceArtifactId: "source",
  status: "RUNNING",
  stage: "RECOGNIZING",
  generation: 2,
  updatedAt: "2026-09-29T10:00:00.000Z",
  finalContentId: null,
  failureId: null,
  investigationRecorded: false,
  progress: { completed: 1, total: 8 },
};
