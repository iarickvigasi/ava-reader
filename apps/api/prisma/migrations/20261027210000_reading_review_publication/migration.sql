ALTER TABLE "CatalogEntry" ADD COLUMN "importSyncPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CatalogEntry" ADD COLUMN "importSyncRevision" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "CatalogEntry_importSyncPending_idx" ON "CatalogEntry" ("importSyncPending");
UPDATE "CatalogEntry" SET "importSyncPending" = true, "importSyncRevision" = 1
WHERE "importKey" IS NOT NULL AND "importPublishedAt" IS NOT NULL;
