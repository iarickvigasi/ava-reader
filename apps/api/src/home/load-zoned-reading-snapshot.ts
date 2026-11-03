import { readingCoverage, readingCoverageSelect } from './reading-coverage';
import type { PrismaService } from '../prisma/prisma.service';
import type { readingWindow } from './reading-window';

export async function loadZonedReadingSnapshot(
  prisma: PrismaService,
  userId: string,
  options: { window: ReturnType<typeof readingWindow>; before?: string },
) {
  const { window, before } = options;
  const trackedDay = { gte: window.start, lt: window.end };
  const [segments, intervals, total, sessions, earliest, user] =
    await prisma.$transaction(
      [
        prisma.readingSessionSegment.findMany({
          where: { userId, trackedDay },
          select: { trackedDay: true, durationSeconds: true },
        }),
        prisma.readingSessionInterval.findMany({
          where: {
            readingSession: { userId },
            startedAt: { lt: window.end },
            endedAt: { gt: window.start },
          },
          select: {
            startedAt: true,
            endedAt: true,
            readingSession: { select: { timeZone: true } },
          },
        }),
        prisma.readingSessionSegment.aggregate({
          where: { userId },
          _sum: { durationSeconds: true },
        }),
        prisma.readingSession.findMany({
          where: {
            userId,
            clientSessionId: { not: null },
            ...(before ? { segments: { some: { trackedDay } } } : {}),
          },
          select: readingCoverageSelect,
        }),
        prisma.readingSessionSegment.findFirst({
          where: { userId },
          orderBy: { trackedDay: 'asc' },
          select: { trackedDay: true },
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
    intervals: intervals.map((row) => ({
      ...row,
      timeZone: row.readingSession.timeZone,
    })),
    earliestDay: earliest?.trackedDay ?? null,
    totalSeconds: total._sum.durationSeconds ?? 0,
    coverage: readingCoverage(sessions, user.readingRevision),
  };
}
