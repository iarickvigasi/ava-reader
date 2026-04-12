-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BlobPurpose" AS ENUM ('BOOK_SOURCE', 'BOOK_COVER', 'FEEDBACK_ATTACHMENT', 'DERIVED_READER');

-- CreateEnum
CREATE TYPE "public"."BookFileFormat" AS ENUM ('EPUB', 'PDF', 'READER_PACKAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."BookFileKind" AS ENUM ('SOURCE', 'DERIVED_READER');

-- CreateEnum
CREATE TYPE "public"."CatalogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."CollectionKind" AS ENUM ('SMART', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."LibrarySource" AS ENUM ('IMPORTED', 'CATALOG');

-- CreateEnum
CREATE TYPE "public"."ProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."AiComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "locator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Annotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "note" TEXT,
    "highlightColor" TEXT,
    "locator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "author" TEXT,
    "description" TEXT,
    "language" TEXT,
    "publishedYear" INTEGER,
    "coverBlobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookFile" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "kind" "public"."BookFileKind" NOT NULL,
    "format" "public"."BookFileFormat" NOT NULL,
    "processingStatus" "public"."ProcessingStatus" NOT NULL DEFAULT 'READY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookProcessingRun" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "outputFileId" TEXT,
    "pipeline" TEXT NOT NULL,
    "status" "public"."ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CatalogEntry" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" "public"."CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "editorialTitle" TEXT,
    "editorialDescription" TEXT,
    "curatorNote" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredRank" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."CollectionKind" NOT NULL DEFAULT 'CUSTOM',
    "smartKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentBlobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "source" "public"."LibrarySource" NOT NULL,
    "originCatalogEntryId" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "currentLocator" TEXT,
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "chapterLabel" TEXT,
    "minutesRead" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReadingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "trackedDay" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastTrackedAt" TIMESTAMP(3),

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoredBlob" (
    "id" TEXT NOT NULL,
    "purpose" "public"."BlobPurpose" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "primaryEmail" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiComment_userId_createdAt_idx" ON "public"."AiComment"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Annotation_userId_createdAt_idx" ON "public"."Annotation"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "public"."Book"("title" ASC);

-- CreateIndex
CREATE INDEX "BookFile_blobId_idx" ON "public"."BookFile"("blobId" ASC);

-- CreateIndex
CREATE INDEX "BookFile_bookId_kind_idx" ON "public"."BookFile"("bookId" ASC, "kind" ASC);

-- CreateIndex
CREATE INDEX "BookProcessingRun_bookId_status_idx" ON "public"."BookProcessingRun"("bookId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogEntry_bookId_key" ON "public"."CatalogEntry"("bookId" ASC);

-- CreateIndex
CREATE INDEX "CatalogEntry_status_isFeatured_sortOrder_idx" ON "public"."CatalogEntry"("status" ASC, "isFeatured" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "public"."Collection"("userId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_smartKey_key" ON "public"."Collection"("userId" ASC, "smartKey" ASC);

-- CreateIndex
CREATE INDEX "Collection_userId_sortOrder_idx" ON "public"."Collection"("userId" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_libraryItemId_key" ON "public"."CollectionItem"("collectionId" ASC, "libraryItemId" ASC);

-- CreateIndex
CREATE INDEX "FeedbackSubmission_userId_createdAt_idx" ON "public"."FeedbackSubmission"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "LibraryItem_userId_addedAt_idx" ON "public"."LibraryItem"("userId" ASC, "addedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userId_bookId_key" ON "public"."LibraryItem"("userId" ASC, "bookId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_libraryItemId_key" ON "public"."ReadingProgress"("libraryItemId" ASC);

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_lastReadAt_idx" ON "public"."ReadingProgress"("userId" ASC, "lastReadAt" ASC);

-- CreateIndex
CREATE INDEX "ReadingSession_userId_libraryItemId_endedAt_idx" ON "public"."ReadingSession"("userId" ASC, "libraryItemId" ASC, "endedAt" ASC);

-- CreateIndex
CREATE INDEX "ReadingSession_userId_trackedDay_idx" ON "public"."ReadingSession"("userId" ASC, "trackedDay" ASC);

-- CreateIndex
CREATE INDEX "StoredBlob_checksum_idx" ON "public"."StoredBlob"("checksum" ASC);

-- CreateIndex
CREATE INDEX "StoredBlob_purpose_idx" ON "public"."StoredBlob"("purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "public"."User"("clerkUserId" ASC);

-- AddForeignKey
ALTER TABLE "public"."AiComment" ADD CONSTRAINT "AiComment_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiComment" ADD CONSTRAINT "AiComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Annotation" ADD CONSTRAINT "Annotation_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Book" ADD CONSTRAINT "Book_coverBlobId_fkey" FOREIGN KEY ("coverBlobId") REFERENCES "public"."StoredBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookFile" ADD CONSTRAINT "BookFile_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "public"."StoredBlob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookFile" ADD CONSTRAINT "BookFile_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookProcessingRun" ADD CONSTRAINT "BookProcessingRun_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookProcessingRun" ADD CONSTRAINT "BookProcessingRun_outputFileId_fkey" FOREIGN KEY ("outputFileId") REFERENCES "public"."BookFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookProcessingRun" ADD CONSTRAINT "BookProcessingRun_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "public"."BookFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogEntry" ADD CONSTRAINT "CatalogEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CatalogEntry" ADD CONSTRAINT "CatalogEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionItem" ADD CONSTRAINT "CollectionItem_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_attachmentBlobId_fkey" FOREIGN KEY ("attachmentBlobId") REFERENCES "public"."StoredBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LibraryItem" ADD CONSTRAINT "LibraryItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LibraryItem" ADD CONSTRAINT "LibraryItem_originCatalogEntryId_fkey" FOREIGN KEY ("originCatalogEntryId") REFERENCES "public"."CatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LibraryItem" ADD CONSTRAINT "LibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReadingProgress" ADD CONSTRAINT "ReadingProgress_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReadingSession" ADD CONSTRAINT "ReadingSession_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "public"."LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReadingSession" ADD CONSTRAINT "ReadingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

