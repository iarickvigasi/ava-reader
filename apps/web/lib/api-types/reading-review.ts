export type ReadingReview = {
  id: string;
  editionId: string;
  checksum: string;
  title: string;
  authors: string[];
  language: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  processingStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error?: string | null;
  syncPending: boolean;
  withdrawn: boolean;
  sourceUrl: string;
  filename: string;
  review: {
    rightsStatement: string;
    rightsUrl: string;
    rightsJurisdiction: string;
    notes: string;
  } | null;
};
