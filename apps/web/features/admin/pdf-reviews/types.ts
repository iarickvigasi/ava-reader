export type ReviewSummary = {
  operationId: string;
  title: string;
  status: string;
  validationId: string;
  verdict: "PASS" | "REVIEW" | "BLOCKED";
  hardBlocks: string[];
  reviewFindings: string[];
  createdAt: string;
};
export type ReviewFile = {
  artifactId: string;
  sha256: string;
  byteLength: number;
  mediaType: string;
  url: string;
};
export type ReviewSnapshot = ReviewSummary & {
  decision: null | {
    decision: "APPROVE" | "REJECT";
    findings: string[];
    decidedAt: string;
  };
  source: ReviewFile;
  candidate: ReviewFile;
  canonical: ReviewFile;
  report: ReviewFile;
  resources: (ReviewFile & { resourceId: string })[];
};
export type ReviewInput = {
  validationId: string;
  decision: "APPROVE" | "REJECT";
  findings: string[];
};
export type ReviewRequest = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;
export const reviewPath = (id: string) =>
  `/api/admin/pdf-imports/${encodeURIComponent(id)}/review`;
