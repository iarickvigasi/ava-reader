CREATE TABLE "EditionImportEvidence" (
  "editionId" UUID NOT NULL,
  "checksum" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "downloadUrl" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL,
  "research" JSONB,
  CONSTRAINT "EditionImportEvidence_pkey" PRIMARY KEY ("editionId", "checksum"),
  CONSTRAINT "EditionImportEvidence_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
