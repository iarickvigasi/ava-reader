import type { Prisma } from '@prisma/client';
import {
  readingCoverage,
  readingCoverageSelect,
} from '../../home/reading-coverage';

export async function loadBookReadingSnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
) {
  const [sessions, total, user] = await Promise.all([
    tx.readingSession.findMany({
      where: { userId, libraryItemId, clientSessionId: { not: null } },
      select: readingCoverageSelect,
    }),
    tx.readingSessionSegment.aggregate({
      where: { userId, libraryItemId },
      _sum: { durationSeconds: true },
    }),
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { readingRevision: true },
    }),
  ]);
  return {
    ...readingCoverage(sessions, user.readingRevision),
    totalSeconds: total._sum.durationSeconds ?? 0,
  };
}
