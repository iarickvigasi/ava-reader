import type { Prisma, ReadingSession } from '@prisma/client';
import { recordReadingInterval } from './record-reading-interval';
import { splitSessionSeconds } from './split-session-seconds';

type Session = Pick<ReadingSession, 'id' | 'libraryItemId' | 'userId'>;

export async function incrementSessionSegmentsTx(
  tx: Prisma.TransactionClient,
  session: Session,
  startTimestamp: Date,
  elapsedSeconds: number,
) {
  await recordReadingInterval(tx, session.id, startTimestamp, elapsedSeconds);
  const segments = splitSessionSeconds(startTimestamp, elapsedSeconds);
  for (const segment of segments)
    await incrementDaySegment(tx, session, segment);
}

function incrementDaySegment(
  tx: Prisma.TransactionClient,
  session: Session,
  segment: { trackedDay: Date; durationSeconds: number },
) {
  return tx.readingSessionSegment.upsert({
    where: {
      readingSessionId_trackedDay: {
        readingSessionId: session.id,
        trackedDay: segment.trackedDay,
      },
    },
    update: {
      durationSeconds: { increment: segment.durationSeconds },
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
