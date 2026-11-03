import { readingCoverage, readingCoverageSelect } from './reading-coverage';
import type { PrismaService } from '../prisma/prisma.service';

export async function loadMasteryHistorySnapshot(
  prisma: PrismaService,
  userId: string,
  window: { start: Date; end: Date },
) {
  const trackedDay = { gte: window.start, lt: window.end };
  const [segments, earliest, sessions, user] = await prisma.$transaction(
    [
      prisma.readingSessionSegment.findMany({
        where: { userId, trackedDay },
        select: { trackedDay: true, durationSeconds: true },
      }),
      prisma.readingSessionSegment.findFirst({
        where: { userId },
        orderBy: { trackedDay: 'asc' },
        select: { trackedDay: true },
      }),
      prisma.readingSession.findMany({
        where: {
          userId,
          clientSessionId: { not: null },
          segments: { some: { trackedDay } },
        },
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
    segments,
    earliestDay: earliest?.trackedDay ?? null,
    coverage: readingCoverage(sessions, user.readingRevision),
  };
}
