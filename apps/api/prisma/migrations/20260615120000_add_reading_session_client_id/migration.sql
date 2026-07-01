-- Adds a client-generated stable session id so offline-replayed sessions
-- upsert to a single row (one per `(userId, clientSessionId)`), instead of
-- creating duplicates when the offline session is posted after reconnect.
-- Nullable to preserve historical rows + the online path that never sent
-- one.

ALTER TABLE "ReadingSession" ADD COLUMN "clientSessionId" TEXT;

-- Composite unique index matching the schema's @@unique([userId,
-- clientSessionId]). Postgres treats NULLs as distinct in a unique index
CREATE UNIQUE INDEX "ReadingSession_userId_clientSessionId_key"
  ON "ReadingSession"("userId", "clientSessionId");
