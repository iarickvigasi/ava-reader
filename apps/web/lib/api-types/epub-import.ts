export type EpubImportSummary = {
  status: "PENDING" | "PROCESSING" | "AWAITING_ACCEPTANCE" | "FAILED" | "READY";
  runId: string | null;
  updatedAt: string | null;
  finalContentId: string | null;
};
