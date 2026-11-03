import type { Prisma, ReadingSession } from '@prisma/client';
import { incrementSessionSegmentsTx } from './session-segments';
import { syncReadingProgressMinutesTx } from './sync-progress-minutes';

export async function creditCheckpoint(
  tx: Prisma.TransactionClient,
  session: ReadingSession,
  durationSeconds: number,
) {
  const delta = durationSeconds - session.durationSeconds;
  if (delta <= 0) return;
  const prefixEnd = new Date(
    Math.floor(+session.startedAt / 1000) * 1000 +
      session.durationSeconds * 1000,
  );
  await incrementSessionSegmentsTx(tx, session, prefixEnd, delta);
  await syncReadingProgressMinutesTx(tx, session.userId, session.libraryItemId);
}
