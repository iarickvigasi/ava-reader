-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('AUTHOR', 'TRANSLATOR', 'EDITOR', 'ILLUSTRATOR');

-- CreateEnum
CREATE TYPE "PublicationFormat" AS ENUM ('EBOOK', 'PAPERBACK', 'HARDCOVER', 'AUDIOBOOK', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Author" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorAlias" (
    "authorId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AuthorAlias_pkey" PRIMARY KEY ("authorId","name")
);

-- CreateTable
CREATE TABLE "AuthorText" (
    "authorId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "biography" TEXT NOT NULL,

    CONSTRAINT "AuthorText_pkey" PRIMARY KEY ("authorId","locale")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" UUID NOT NULL,
    "workId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT,
    "publisher" TEXT,
    "publishedYear" INTEGER,
    "format" "PublicationFormat" NOT NULL DEFAULT 'UNKNOWN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionCredit" (
    "editionId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "role" "CreditRole" NOT NULL,
    "creditedAs" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EditionCredit_pkey" PRIMARY KEY ("editionId","authorId","role")
);

-- CreateTable
CREATE TABLE "Identifier" (
    "id" UUID NOT NULL,
    "scheme" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,

    CONSTRAINT "Identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionIdentifier" (
    "editionId" UUID NOT NULL,
    "identifierId" UUID NOT NULL,

    CONSTRAINT "EditionIdentifier_pkey" PRIMARY KEY ("editionId","identifierId")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMapping" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "entityKind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceRevision" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workId" UUID,
    "editionId" UUID,
    "authorId" UUID,

    CONSTRAINT "SourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" UUID NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalLanguage" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkText" (
    "workId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "WorkText_pkey" PRIMARY KEY ("workId","locale")
);

-- CreateTable
CREATE TABLE "WorkCredit" (
    "workId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "role" "CreditRole" NOT NULL DEFAULT 'AUTHOR',
    "creditedAs" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkCredit_pkey" PRIMARY KEY ("workId","authorId","role")
);

-- CreateIndex
CREATE INDEX "Edition_workId_id_idx" ON "Edition"("workId", "id");

-- CreateIndex
CREATE INDEX "Edition_language_workId_idx" ON "Edition"("language", "workId");

-- CreateIndex
CREATE INDEX "EditionCredit_authorId_editionId_idx" ON "EditionCredit"("authorId", "editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Identifier_scheme_normalizedValue_key" ON "Identifier"("scheme", "normalizedValue");

-- CreateIndex
CREATE INDEX "EditionIdentifier_identifierId_editionId_idx" ON "EditionIdentifier"("identifierId", "editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "SourceMapping_workId_idx" ON "SourceMapping"("workId");

-- CreateIndex
CREATE INDEX "SourceMapping_editionId_idx" ON "SourceMapping"("editionId");

-- CreateIndex
CREATE INDEX "SourceMapping_authorId_idx" ON "SourceMapping"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMapping_sourceId_entityKind_externalId_key" ON "SourceMapping"("sourceId", "entityKind", "externalId");

-- CreateIndex
CREATE INDEX "WorkCredit_authorId_workId_idx" ON "WorkCredit"("authorId", "workId");

-- AddForeignKey
ALTER TABLE "AuthorAlias" ADD CONSTRAINT "AuthorAlias_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorText" ADD CONSTRAINT "AuthorText_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionCredit" ADD CONSTRAINT "EditionCredit_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionCredit" ADD CONSTRAINT "EditionCredit_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionIdentifier" ADD CONSTRAINT "EditionIdentifier_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionIdentifier" ADD CONSTRAINT "EditionIdentifier_identifierId_fkey" FOREIGN KEY ("identifierId") REFERENCES "Identifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkText" ADD CONSTRAINT "WorkText_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCredit" ADD CONSTRAINT "WorkCredit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCredit" ADD CONSTRAINT "WorkCredit_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A source record identifies exactly one canonical entity of its declared kind.
ALTER TABLE "SourceMapping" ADD CONSTRAINT "SourceMapping_target_check" CHECK (
  ("entityKind" = 'WORK' AND "workId" IS NOT NULL AND "editionId" IS NULL AND "authorId" IS NULL)
  OR ("entityKind" = 'EDITION' AND "editionId" IS NOT NULL AND "workId" IS NULL AND "authorId" IS NULL)
  OR ("entityKind" = 'AUTHOR' AND "authorId" IS NOT NULL AND "workId" IS NULL AND "editionId" IS NULL)
);
