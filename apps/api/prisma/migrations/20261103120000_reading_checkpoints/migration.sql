ALTER TABLE "User" ADD COLUMN "readingRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReadingSession"
  ADD COLUMN "trackingVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "checkpointRevision" INTEGER NOT NULL DEFAULT 0;

-- Each device records an independent run; active sessions no longer share one row.
DROP INDEX "ReadingSession_active_user_library_unique";
