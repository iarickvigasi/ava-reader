export type PdfReviewSummary = {
  operationId: string;
  title: string;
  status: string;
  validationId: string;
  verdict: 'PASS' | 'REVIEW' | 'BLOCKED';
  hardBlocks: string[];
  reviewFindings: string[];
  createdAt: string;
};
export type PdfReviewFile = {
  artifactId: string;
  sha256: string;
  byteLength: number;
  mediaType: string;
  url: string;
};
export type PdfReviewSnapshot = PdfReviewSummary & {
  decision: null | {
    decision: 'APPROVE' | 'REJECT';
    findings: string[];
    decidedAt: string;
  };
  source: PdfReviewFile;
  candidate: PdfReviewFile;
  canonical: PdfReviewFile;
  report: PdfReviewFile;
  resources: (PdfReviewFile & { resourceId: string })[];
};
export type PdfReviewInput = {
  validationId: string;
  decision: 'APPROVE' | 'REJECT';
  findings: string[];
};
