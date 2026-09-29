export type PdfImportSummary = {
  operationId: string;
  libraryItemId: string;
  status: "QUEUED" | "RUNNING" | "WAITING" | "READY" | "FAILED" | "STOPPED";
  stage: string;
  generation: number;
  updatedAt: string;
  sourceArtifactId: string;
  finalContentId: string | null;
  failureId: string | null;
  investigationRecorded: boolean;
  progress: { completed: number; total: number } | null;
};
