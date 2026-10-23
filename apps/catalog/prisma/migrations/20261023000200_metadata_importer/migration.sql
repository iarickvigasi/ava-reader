-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('STAGING', 'STAGED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRecordStatus" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED', 'INVALID', 'UNRESOLVED', 'CONFLICT');

-- AlterTable
ALTER TABLE "SourceMapping" ADD COLUMN     "managedRevision" INTEGER,
ADD COLUMN     "payloadHash" TEXT;

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "checksum" TEXT NOT NULL,
    "adapterVersion" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'STAGING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "line" INTEGER NOT NULL,
    "kind" TEXT,
    "externalId" TEXT,
    "revision" INTEGER,
    "modifiedAt" TIMESTAMP(3),
    "payloadHash" TEXT,
    "payload" JSONB,
    "status" "ImportRecordStatus" NOT NULL DEFAULT 'PENDING',
    "diagnostic" TEXT,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogOutbox" (
    "id" BIGSERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'METADATA_UPSERTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_checksum_adapterVersion_key" ON "ImportRun"("checksum", "adapterVersion");

-- CreateIndex
CREATE INDEX "ImportRecord_kind_status_id_idx" ON "ImportRecord"("kind", "status", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRecord_runId_line_key" ON "ImportRecord"("runId", "line");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogOutbox_kind_entityId_revision_key" ON "CatalogOutbox"("kind", "entityId", "revision");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
