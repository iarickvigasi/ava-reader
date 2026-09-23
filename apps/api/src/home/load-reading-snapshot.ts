import type { PrismaService } from '../prisma/prisma.service';
import { daysAgo, startOfDay } from '../shared/date-utils';

const HOME_ACTIVITY_DAYS = 7;

export async function loadReadingSnapshot(
  prisma: PrismaService,
  userId: string,
) {
  // IDs and aggregates must see the same committed sessions, including a replay
  // committed while this GET is running. ReadCommitted is not sufficient.
  const [recentReadingSessions, total, sessions] = await prisma.$transaction(
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
      // All-time coverage: an old offline session can be replayed today.
      prisma.readingSession.findMany({
        where: { userId, clientSessionId: { not: null } },
        select: { clientSessionId: true },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  return {
    recentReadingSessions,
    readingSnapshot: {
      clientSessionIds: sessions.flatMap((row) =>
        row.clientSessionId ? [row.clientSessionId] : [],
      ),
      totalSeconds: total._sum.durationSeconds ?? 0,
      days: recentReadingSessions.map((row) => ({
        key: row.trackedDay.toISOString().slice(0, 10),
        seconds: row.durationSeconds,
      })),
    },
  };
}
