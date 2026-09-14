import type { PrismaService } from '../prisma/prisma.service';
import {
  isBookFinished,
  serializeCompletionItem,
} from '../shared/book-completion';
import { daysAgo, startOfDay } from '../shared/date-utils';

const HOME_ACTIVITY_DAYS = 7;
const SECONDS_PER_HOUR = 3_600;

export async function loadHomeActivity(prisma: PrismaService, userId: string) {
  const [
    recentReadingSessions,
    totalReadingSecondsAggregate,
    highlightsCount,
    completionItems,
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
    // All-time totals preserve archived books. Derive the count and its
    // reconciliation snapshot from one read so they cannot race each other.
    prisma.libraryItem.findMany({
      where: { userId },
      select: {
        id: true,
        finishedAt: true,
        progress: { select: { completionPercent: true } },
      },
    }),
    prisma.aiComment.count({ where: { userId } }),
  ]);
  const totalReadingSeconds =
    totalReadingSecondsAggregate._sum.durationSeconds ?? 0;

  return {
    completionItems: completionItems.map(serializeCompletionItem),
    recentReadingSessions,
    stats: {
      aiComments: aiCommentsCount,
      highlights: highlightsCount,
      hoursReading: Math.floor(totalReadingSeconds / SECONDS_PER_HOUR),
      volumesRead: completionItems.filter(isBookFinished).length,
    },
  };
}
