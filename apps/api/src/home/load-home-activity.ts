import type { PrismaService } from '../prisma/prisma.service';
import { daysAgo, startOfDay } from '../shared/date-utils';

const HOME_ACTIVITY_DAYS = 7;
const SECONDS_PER_HOUR = 3_600;
const COMPLETE_PROGRESS_PERCENT = 100;

export async function loadHomeActivity(prisma: PrismaService, userId: string) {
  const [
    recentReadingSessions,
    totalReadingSecondsAggregate,
    highlightsCount,
    completedBooksCount,
    aiCommentsCount,
  ] = await Promise.all([
    prisma.readingSessionSegment.findMany({
      where: {
        userId,
        trackedDay: {
          gte: startOfDay(daysAgo(HOME_ACTIVITY_DAYS - 1)),
        },
      },
      orderBy: { trackedDay: 'asc' },
      select: { durationSeconds: true, trackedDay: true },
    }),
    prisma.readingSessionSegment.aggregate({
      where: { userId },
      _sum: { durationSeconds: true },
    }),
    prisma.annotation.count({ where: { userId } }),
    prisma.readingProgress.count({
      where: {
        userId,
        completionPercent: { gte: COMPLETE_PROGRESS_PERCENT },
      },
    }),
    prisma.aiComment.count({ where: { userId } }),
  ]);
  const totalReadingSeconds =
    totalReadingSecondsAggregate._sum.durationSeconds ?? 0;

  return {
    recentReadingSessions,
    stats: {
      aiComments: aiCommentsCount,
      highlights: highlightsCount,
      hoursReading: Math.floor(totalReadingSeconds / SECONDS_PER_HOUR),
      volumesRead: completedBooksCount,
    },
  };
}
