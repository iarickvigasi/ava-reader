ALTER TABLE "LibraryItem" ADD COLUMN "catalogLink" JSONB;
ALTER TABLE "LibraryItem" ADD COLUMN "catalogLinkMutationId" TEXT;
ALTER TABLE "LibraryItem" ADD COLUMN "catalogLinkVersion" INTEGER NOT NULL DEFAULT 0;
