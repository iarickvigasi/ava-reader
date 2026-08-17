import type { Prisma } from '@prisma/client';
import type { LockedSessionRecord } from './session-record';

const SESSION_SECONDS_PER_DAY = 86_400;

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function computeElapsedSeconds(lastTrackedAt: Date, timestamp: Date) {
  return Math.max(
    Math.round((timestamp.getTime() - lastTrackedAt.getTime()) / 1000),
    0,
  );
}

// A span that crosses midnight UTC belongs to two days. Splitting it keeps the
// per-day reading totals on home honest.
function splitElapsedSecondsByUtcDay(start: Date, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) {
    return [] as Array<{ durationSeconds: number; trackedDay: Date }>;
  }

  const segments: Array<{ durationSeconds: number; trackedDay: Date }> = [];
  let cursorSeconds = Math.floor(start.getTime() / 1000);
  const endSeconds = cursorSeconds + elapsedSeconds;

  while (cursorSeconds < endSeconds) {
    const cursorDate = new Date(cursorSeconds * 1000);
    const trackedDay = startOfUtcDay(cursorDate);
    const nextDayBoundarySeconds =
      Math.floor(trackedDay.getTime() / 1000) + SESSION_SECONDS_PER_DAY;
    const sliceEnd = Math.min(endSeconds, nextDayBoundarySeconds);
    const durationSeconds = Math.max(sliceEnd - cursorSeconds, 0);

    if (durationSeconds > 0) {
      segments.push({
        durationSeconds,
        trackedDay,
      });
    }

    cursorSeconds = sliceEnd;
  }

  return segments;
}

export async function incrementSessionSegmentsTx(
  tx: Prisma.TransactionClient,
  session: LockedSessionRecord,
  startTimestamp: Date,
  elapsedSeconds: number,
) {
  const segmentDeltas = splitElapsedSecondsByUtcDay(
    startTimestamp,
    elapsedSeconds,
  );

  for (const segment of segmentDeltas) {
    await tx.readingSessionSegment.upsert({
      where: {
        readingSessionId_trackedDay: {
          readingSessionId: session.id,
          trackedDay: segment.trackedDay,
        },
      },
      update: {
        durationSeconds: {
          increment: segment.durationSeconds,
        },
      },
      create: {
        durationSeconds: segment.durationSeconds,
        libraryItemId: session.libraryItemId,
        readingSessionId: session.id,
        trackedDay: segment.trackedDay,
        userId: session.userId,
      },
    });
  }
}
