export type CatalogRightsResearch = {
  author: string;
  title: string;
  authorDeathYear: number;
  authorEvidenceUrl: string;
  titleEvidenceUrls: string[];
  ordinaryLife70Expiry: string;
  life100ComparisonExpiry: string;
  researchedAt: string;
  rules: { id: string; evidenceUrl: string }[];
};
export type CatalogImportEvidence = {
  checksum: string;
  provider: string;
  sourceUrl: string;
  downloadUrl: string;
  filename: string;
  inspectedAt: string;
  research: CatalogRightsResearch | null;
};
