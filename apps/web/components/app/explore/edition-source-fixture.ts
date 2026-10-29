import type { CatalogEditionDetail } from "@/lib/catalog-types";
export const edition: Pick<
  CatalogEditionDetail,
  "importEvidence" | "readingAssets"
> = {
  importEvidence: [
    {
      checksum: "hash",
      provider: "standard-ebooks",
      sourceUrl: "https://standardebooks.org/ebooks/jane-austen/emma",
      downloadUrl: "https://standardebooks.org/book.epub",
      filename: "emma.epub",
      inspectedAt: "2026-10-29T12:00:00Z",
      research: {
        title: "Emma",
        author: "Jane Austen",
        authorDeathYear: 1817,
        authorEvidenceUrl: "https://en.wikisource.org/wiki/Author:Jane_Austen",
        titleEvidenceUrls: [],
        ordinaryLife70Expiry: "1888-01-01",
        life100ComparisonExpiry: "1918-01-01",
        researchedAt: "2026-10-29",
        rules: [{ id: "eu-term", evidenceUrl: "https://eur-lex.europa.eu/" }],
      },
    },
  ],
};
