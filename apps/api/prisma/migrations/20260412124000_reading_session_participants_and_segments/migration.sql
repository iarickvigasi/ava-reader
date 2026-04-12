-- Keep existing session rows compatible with the new tracking model.
ALTER TABLE "ReadingSession"
ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReadingSession"
ADD COLUMN IF NOT EXISTS "lastTrackedAt" TIMESTAMP(3);

ALTER TABLE "ReadingSession"
ALTER COLUMN "durationMinutes" SET DEFAULT 0;

UPDATE "ReadingSession"
SET "durationSeconds" = GREATEST("durationSeconds", "durationMinutes" * 60)
WHERE "durationMinutes" > 0;

-- CreateTable
CREATE TABLE "ReadingSessionParticipant" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "clientInstanceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingSessionSegment" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "trackedDay" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingSessionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingSessionParticipant_readingSessionId_clientInstanceId_key"
ON "ReadingSessionParticipant"("readingSessionId", "clientInstanceId");

-- CreateIndex
CREATE INDEX "ReadingSessionParticipant_readingSessionId_stoppedAt_lastSeenAt_idx"
ON "ReadingSessionParticipant"("readingSessionId", "stoppedAt", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ReadingSessionParticipant_userId_libraryItemId_lastSeenAt_idx"
ON "ReadingSessionParticipant"("userId", "libraryItemId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingSessionSegment_readingSessionId_trackedDay_key"
ON "ReadingSessionSegment"("readingSessionId", "trackedDay");

-- CreateIndex
CREATE INDEX "ReadingSessionSegment_userId_trackedDay_idx"
ON "ReadingSessionSegment"("userId", "trackedDay");

-- CreateIndex
CREATE INDEX "ReadingSessionSegment_userId_libraryItemId_trackedDay_idx"
ON "ReadingSessionSegment"("userId", "libraryItemId", "trackedDay");

-- AddForeignKey
ALTER TABLE "ReadingSessionParticipant"
ADD CONSTRAINT "ReadingSessionParticipant_readingSessionId_fkey"
FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSessionParticipant"
ADD CONSTRAINT "ReadingSessionParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSessionParticipant"
ADD CONSTRAINT "ReadingSessionParticipant_libraryItemId_fkey"
FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSessionSegment"
ADD CONSTRAINT "ReadingSessionSegment_readingSessionId_fkey"
FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSessionSegment"
ADD CONSTRAINT "ReadingSessionSegment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSessionSegment"
ADD CONSTRAINT "ReadingSessionSegment_libraryItemId_fkey"
FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalize duplicate active sessions before enforcing active-session uniqueness.
WITH ranked_active AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "libraryItemId"
            ORDER BY "startedAt" DESC, "createdAt" DESC
        ) AS rn
    FROM "ReadingSession"
    WHERE "endedAt" IS NULL
)
UPDATE "ReadingSession" AS rs
SET
    "endedAt" = COALESCE(rs."lastTrackedAt", rs."startedAt", rs."updatedAt", rs."createdAt", NOW()),
    "updatedAt" = NOW()
FROM ranked_active AS ranked
WHERE rs."id" = ranked."id"
  AND ranked.rn > 1;

-- Backfill one segment per existing session on the session's trackedDay.
INSERT INTO "ReadingSessionSegment" (
    "id",
    "readingSessionId",
    "userId",
    "libraryItemId",
    "trackedDay",
    "durationSeconds",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('backfill:', rs."id"),
    rs."id",
    rs."userId",
    rs."libraryItemId",
    rs."trackedDay",
    rs."durationSeconds",
    NOW(),
    NOW()
FROM "ReadingSession" AS rs
WHERE rs."durationSeconds" > 0
ON CONFLICT ("readingSessionId", "trackedDay")
DO UPDATE SET
    "durationSeconds" = EXCLUDED."durationSeconds",
    "updatedAt" = NOW();

-- Align per-book minutes with backfilled segment totals.
WITH totals AS (
    SELECT
        "userId",
        "libraryItemId",
        FLOOR(SUM("durationSeconds") / 60.0)::INTEGER AS "minutesRead"
    FROM "ReadingSessionSegment"
    GROUP BY "userId", "libraryItemId"
)
UPDATE "ReadingProgress" AS rp
SET
    "minutesRead" = totals."minutesRead",
    "updatedAt" = NOW()
FROM totals
WHERE rp."userId" = totals."userId"
  AND rp."libraryItemId" = totals."libraryItemId";

-- Enforce exactly one active session per user/book pair.
CREATE UNIQUE INDEX "ReadingSession_active_user_library_unique"
ON "ReadingSession"("userId", "libraryItemId")
WHERE "endedAt" IS NULL;
