-- CreateEnum
CREATE TYPE "BookAnalysisKind" AS ENUM ('CHAPTER_PURPOSE');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "estimatedBodyPageCount" INTEGER;

-- CreateTable
CREATE TABLE "BookAnalysis" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "kind" "BookAnalysisKind" NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "promptVersion" INTEGER NOT NULL,
    "modelId" TEXT,
    "readerFileId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookAnalysis_bookId_status_idx" ON "BookAnalysis"("bookId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookAnalysis_bookId_kind_key" ON "BookAnalysis"("bookId", "kind");

-- AddForeignKey
ALTER TABLE "BookAnalysis" ADD CONSTRAINT "BookAnalysis_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

