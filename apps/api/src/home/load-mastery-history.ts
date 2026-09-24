import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export async function loadMasteryHistory(
  prisma: PrismaService,
  userId: string,
  before: string,
) {
  const end = new Date(`${before}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(before) ||
    !Number.isFinite(end.getTime()) ||
    end.toISOString().slice(0, 10) !== before
  ) {
    throw new BadRequestException('before must be a valid YYYY-MM-DD date');
  }
  const start = new Date(end.getTime() - WEEK_DAYS * DAY_MS);
  const [segments, earliest, sessions] = await prisma.$transaction(
    [
      prisma.readingSessionSegment.findMany({
        where: { userId, trackedDay: { gte: start, lt: end } },
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
          segments: { some: { trackedDay: { gte: start, lt: end } } },
        },
        select: { clientSessionId: true },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  const seconds = new Map<string, number>();
  for (const segment of segments) {
    const key = segment.trackedDay.toISOString().slice(0, 10);
    seconds.set(key, (seconds.get(key) ?? 0) + segment.durationSeconds);
  }
  return {
    days: Array.from({ length: WEEK_DAYS }, (_, index) => {
      const key = new Date(start.getTime() + index * DAY_MS)
        .toISOString()
        .slice(0, 10);
      return { key, seconds: seconds.get(key) ?? 0 };
    }),
    clientSessionIds: sessions.flatMap((row) =>
      row.clientSessionId ? [row.clientSessionId] : [],
    ),
    nextBefore:
      earliest && earliest.trackedDay < start
        ? start.toISOString().slice(0, 10)
        : null,
  };
}
