CREATE TABLE "ReadingSessionInterval" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingSessionInterval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReadingSessionInterval_readingSessionId_fkey"
      FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReadingSessionInterval_readingSessionId_endedAt_idx"
  ON "ReadingSessionInterval"("readingSessionId", "endedAt");
CREATE INDEX "ReadingSessionInterval_startedAt_endedAt_idx"
  ON "ReadingSessionInterval"("startedAt", "endedAt");

-- Recover only continuous sessions whose complete UTC allocation matches the
-- existing rounded/floored accounting. Ambiguous sessions remain legacy totals.
WITH candidates AS (
  SELECT s."id", date_trunc('second', s."startedAt") AS start_at,
    date_trunc('second', s."startedAt") + s."durationSeconds" * interval '1 second' AS end_at,
    s."durationSeconds" AS seconds
  FROM "ReadingSession" s
  WHERE s."durationSeconds" > 0
    AND round(extract(epoch FROM (coalesce(s."endedAt", s."lastTrackedAt") - s."startedAt")))
      = s."durationSeconds"
), proven AS (
  SELECT c.* FROM candidates c
  WHERE (SELECT sum(g."durationSeconds") FROM "ReadingSessionSegment" g
         WHERE g."readingSessionId" = c."id") = c.seconds
    AND NOT EXISTS (
      SELECT 1 FROM "ReadingSessionSegment" g
      WHERE g."readingSessionId" = c."id"
        AND g."durationSeconds" <> greatest(0, extract(epoch FROM
          (least(c.end_at, g."trackedDay" + interval '1 day') - greatest(c.start_at, g."trackedDay"))))
    )
)
INSERT INTO "ReadingSessionInterval" ("id", "readingSessionId", "startedAt", "endedAt")
SELECT 'legacy-' || "id", "id", start_at, end_at FROM proven;
