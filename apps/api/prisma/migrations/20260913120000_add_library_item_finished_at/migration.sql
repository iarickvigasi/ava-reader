-- Finish dates are user-entered and cannot be inferred from reading progress.
ALTER TABLE "LibraryItem" ADD COLUMN "finishedAt" TIMESTAMP(3);
