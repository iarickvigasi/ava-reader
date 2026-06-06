-- Adds a client-generated stable session id so offline-replayed sessions
-- upsert to a single row (one per `(userId, clientSessionId)`), instead of
-- creating duplicates when the offline session is posted after reconnect.
-- Nullable to preserve historical rows + the online path that never sent
-- one.

ALTER TABLE "ReadingSession" ADD COLUMN "clientSessionId" TEXT;

-- Partial unique index so we only enforce uniqueness across rows that
-- carry an id; historical NULL rows can coexist freely.
CREATE UNIQUE INDEX "ReadingSession_userId_clientSessionId_key"
  ON "ReadingSession"("userId", "clientSessionId")
  WHERE "clientSessionId" IS NOT NULL;
