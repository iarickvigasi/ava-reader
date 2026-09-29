import type { PrismaService } from '../prisma/prisma.service';
import { readingWindow } from './reading-window';
import { readingWindowData } from './reading-window-data';

export async function loadZonedReading(
  prisma: PrismaService,
  userId: string,
  timeZone: string,
  before?: string,
) {
  const window = readingWindow(timeZone, before);
  const trackedDay = { gte: window.start, lt: window.end };
  const [segments, intervals, total, sessions, earliest] =
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
          select: { clientSessionId: true },
        }),
        prisma.readingSessionSegment.findFirst({
          where: { userId },
          orderBy: { trackedDay: 'asc' },
          select: { trackedDay: true },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  const { firstDay, ...data } = readingWindowData(
    segments,
    intervals.map((row) => ({ ...row, timeZone: row.readingSession.timeZone })),
    window,
    timeZone,
  );
  const first = data.days[0].key;
  const hasEarlier =
    (earliest && earliest.trackedDay < window.start) ||
    (firstDay !== null && firstDay < first);
  return {
    ...data,
    totalSeconds: total._sum.durationSeconds ?? 0,
    clientSessionIds: sessions.flatMap((row) =>
      row.clientSessionId ? [row.clientSessionId] : [],
    ),
    nextBefore: hasEarlier ? first : null,
  };
}
