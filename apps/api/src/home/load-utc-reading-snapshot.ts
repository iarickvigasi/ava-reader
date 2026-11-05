import { readingCoverage, readingCoverageSelect } from './reading-coverage';
import type { PrismaService } from '../prisma/prisma.service';
import { daysAgo, startOfDay } from '../shared/date-utils';

const HOME_ACTIVITY_DAYS = 7;

export async function loadUtcReadingSnapshot(
  prisma: PrismaService,
  userId: string,
) {
  // IDs and aggregates must see the same committed sessions, including a checkpoint
  // committed while this GET is running. ReadCommitted is not sufficient.
  const [recentReadingSessions, total, sessions, user] =
    await prisma.$transaction(
      [
        prisma.readingSessionSegment.findMany({
          where: {
            userId,
            trackedDay: { gte: startOfDay(daysAgo(HOME_ACTIVITY_DAYS - 1)) },
          },
          orderBy: { trackedDay: 'asc' },
          select: { durationSeconds: true, trackedDay: true },
        }),
        prisma.readingSessionSegment.aggregate({
          where: { userId },
          _sum: { durationSeconds: true },
        }),
        // All-time coverage: an old offline session can be uploaded today.
        prisma.readingSession.findMany({
          where: { userId, clientSessionId: { not: null } },
          select: readingCoverageSelect,
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { readingRevision: true },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  return {
    recentReadingSessions,
    coverage: readingCoverage(sessions, user.readingRevision),
    totalSeconds: total._sum.durationSeconds ?? 0,
  };
}
