import type { Prisma } from '@prisma/client';

// Reading minutes on ReadingProgress are a denormalised roll-up of the session
// segments, refreshed whenever a segment moves.
export async function syncReadingProgressMinutesTx(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
) {
  const totalSeconds = await tx.readingSessionSegment.aggregate({
    where: {
      libraryItemId,
      userId,
    },
    _sum: {
      durationSeconds: true,
    },
  });

  await tx.readingProgress.updateMany({
    where: {
      libraryItemId,
      userId,
    },
    data: {
      minutesRead: Math.floor((totalSeconds._sum.durationSeconds ?? 0) / 60),
    },
  });
}
