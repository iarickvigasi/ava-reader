-- CreateTable
CREATE TABLE "PdfConversionInvestigation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "requestKeyHash" TEXT,
    "operationId" TEXT,
    "operationKey" TEXT,
    "bookId" TEXT,
    "libraryItemId" TEXT,
    "jobId" TEXT,
    "failureId" TEXT,
    "finalContentId" TEXT,
    "sourceSha256" TEXT,
    "sourceBytes" INTEGER,
    "sourcePages" INTEGER,
    "configSha256" TEXT,
    "profileId" TEXT,
    "workerFingerprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ADMISSION',
    "stage" TEXT NOT NULL DEFAULT 'ADMISSION',
    "nextSequence" INTEGER NOT NULL DEFAULT 0,
    "activeAdmissionCount" INTEGER NOT NULL DEFAULT 0,
    "coverage" TEXT NOT NULL DEFAULT 'API_LIFECYCLE',
    "evidenceGaps" TEXT[],
    "retentionClass" TEXT NOT NULL DEFAULT 'OPERATIONAL_AUDIT',
    "retentionPolicyId" TEXT,
    "eligibleForPurgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfConversionInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfConversionEvent" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "producerKey" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT,
    "attemptId" TEXT,
    "attemptFence" INTEGER,
    "generation" INTEGER,
    "cancellationEpoch" INTEGER,
    "observedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "durationKind" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfConversionCost" (
    "conversionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "knownActualNano" BIGINT NOT NULL DEFAULT 0,
    "reservedNano" BIGINT NOT NULL DEFAULT 0,
    "uncertainNano" BIGINT NOT NULL DEFAULT 0,
    "actualComplete" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "ledgerWatermark" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL,
    "projection" JSONB NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionClass" TEXT NOT NULL DEFAULT 'BILLING_AUDIT',
    "retentionPolicyId" TEXT,
    "eligibleForPurgeAt" TIMESTAMP(3),

    CONSTRAINT "PdfConversionCost_pkey" PRIMARY KEY ("conversionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionInvestigation_operationId_key" ON "PdfConversionInvestigation"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionInvestigation_operationKey_key" ON "PdfConversionInvestigation"("operationKey");

-- CreateIndex
CREATE INDEX "PdfConversionInvestigation_bookId_createdAt_idx" ON "PdfConversionInvestigation"("bookId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfConversionInvestigation_libraryItemId_createdAt_idx" ON "PdfConversionInvestigation"("libraryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfConversionInvestigation_failureId_idx" ON "PdfConversionInvestigation"("failureId");

-- CreateIndex
CREATE INDEX "PdfConversionInvestigation_status_updatedAt_idx" ON "PdfConversionInvestigation"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionInvestigation_ownerId_requestKeyHash_key" ON "PdfConversionInvestigation"("ownerId", "requestKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionEvent_conversionId_sequence_key" ON "PdfConversionEvent"("conversionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PdfConversionEvent_conversionId_producerKey_key" ON "PdfConversionEvent"("conversionId", "producerKey");

-- AddForeignKey
ALTER TABLE "PdfConversionInvestigation" ADD CONSTRAINT "PdfConversionInvestigation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PdfImportOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfConversionEvent" ADD CONSTRAINT "PdfConversionEvent_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "PdfConversionInvestigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfConversionCost" ADD CONSTRAINT "PdfConversionCost_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "PdfConversionInvestigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
