ALTER TABLE "CatalogEntry" ADD COLUMN "importKey" TEXT;
ALTER TABLE "CatalogEntry" ADD COLUMN "importEvidence" JSONB;
ALTER TABLE "CatalogEntry" ADD COLUMN "importPublishedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "CatalogEntry_importKey_key" ON "CatalogEntry"("importKey");
