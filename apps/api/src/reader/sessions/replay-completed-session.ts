import type { Prisma } from '@prisma/client';
import {
  lockedSessionSelect,
  type LockedSessionRecord,
} from './session-record';
import { incrementSessionSegmentsTx, startOfUtcDay } from './session-segments';
import { syncReadingProgressMinutesTx } from './sync-progress-minutes';

// Records a completed offline session at replay time. Persists the original
// startedAt/endedAt and the real duration, splits it into per-UTC-day
// segments so reading-hour totals stay accurate, and is idempotent on retry.
export async function replayCompletedSessionTx(
  tx: Prisma.TransactionClient,
  params: {
    clientSessionId: string;
    durationSeconds: number;
    endedAt: Date;
    libraryItemId: string;
    startedAt: Date;
    userId: string;
  },
): Promise<LockedSessionRecord> {
  const {
    clientSessionId,
    durationSeconds,
    endedAt,
    libraryItemId,
    startedAt,
    userId,
  } = params;

  const existing = await tx.readingSession.findFirst({
    where: { userId, clientSessionId },
    select: lockedSessionSelect,
  });
  if (existing) {
    // Already recorded — return as-is. Never re-route through 'start', which
    // would reopen (endedAt: null) and re-date (trackedDay: today) the row.
    return existing;
  }

  let session: LockedSessionRecord;
  try {
    session = await tx.readingSession.create({
      data: {
        clientSessionId,
        durationMinutes: Math.floor(durationSeconds / 60),
        durationSeconds,
        endedAt,
        lastTrackedAt: endedAt,
        libraryItemId,
        startedAt,
        trackedDay: startOfUtcDay(startedAt),
        userId,
      },
      select: lockedSessionSelect,
    });
  } catch (error) {
    // Concurrent replay of the same (userId, clientSessionId) lost the
    // unique-constraint race — return the row the winner created.
    const recovered = await tx.readingSession.findFirst({
      where: { userId, clientSessionId },
      select: lockedSessionSelect,
    });
    if (!recovered) {
      throw error;
    }
    return recovered;
  }

  if (durationSeconds > 0) {
    await incrementSessionSegmentsTx(tx, session, startedAt, durationSeconds);
    await syncReadingProgressMinutesTx(tx, userId, libraryItemId);
  }

  return session;
}
