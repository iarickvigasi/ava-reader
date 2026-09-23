import type { PrismaService } from '../prisma/prisma.service';
import {
  isBookFinished,
  serializeCompletionItem,
} from '../shared/book-completion';
import { loadReadingSnapshot } from './load-reading-snapshot';

const SECONDS_PER_HOUR = 3_600;

export async function loadHomeActivity(prisma: PrismaService, userId: string) {
  const [reading, highlightsCount, completionItems, aiCommentsCount] =
    await Promise.all([
      loadReadingSnapshot(prisma, userId),
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
  const totalReadingSeconds = reading.readingSnapshot.totalSeconds;

  return {
    completionItems: completionItems.map(serializeCompletionItem),
    ...reading,
    stats: {
      aiComments: aiCommentsCount,
      highlights: highlightsCount,
      hoursReading: Math.floor(totalReadingSeconds / SECONDS_PER_HOUR),
      volumesRead: completionItems.filter(isBookFinished).length,
    },
  };
}
