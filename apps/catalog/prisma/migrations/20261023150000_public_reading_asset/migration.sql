CREATE TYPE "ReadingAssetStatus" AS ENUM ('PENDING', 'READY', 'WITHDRAWN');
CREATE TABLE "ReadingAsset" (
  "id" UUID NOT NULL,
  "editionId" UUID NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "rightsStatement" TEXT NOT NULL,
  "rightsUrl" TEXT NOT NULL,
  "rightsJurisdiction" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "status" "ReadingAssetStatus" NOT NULL DEFAULT 'PENDING',
  "mainCatalogEntryId" TEXT,
  CONSTRAINT "ReadingAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReadingAsset_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReadingAsset_ready_target" CHECK ("status" <> 'READY' OR length(trim("mainCatalogEntryId")) > 0 AND "mainCatalogEntryId" IS NOT NULL)
);
CREATE UNIQUE INDEX "ReadingAsset_editionId_checksum_key" ON "ReadingAsset"("editionId", "checksum");
CREATE INDEX "ReadingAsset_status_editionId_idx" ON "ReadingAsset"("status", "editionId");
