import type { PrismaService } from '../prisma/prisma.service';
import { loadUtcReadingSnapshot } from './load-utc-reading-snapshot';
import { loadZonedReading } from './load-zoned-reading';

export async function loadReadingSnapshot(
  prisma: PrismaService,
  userId: string,
  timeZone?: string,
) {
  if (timeZone !== undefined) {
    const readingSnapshot = await loadZonedReading(prisma, userId, timeZone);
    return {
      readingSnapshot,
      recentReadingSessions: readingSnapshot.days.map((day) => ({
        trackedDay: new Date(`${day.key}T00:00:00Z`),
        durationSeconds: day.seconds,
      })),
    };
  }
  const snapshot = await loadUtcReadingSnapshot(prisma, userId);
  return {
    recentReadingSessions: snapshot.recentReadingSessions,
    readingSnapshot: {
      ...snapshot.coverage,
      totalSeconds: snapshot.totalSeconds,
      days: snapshot.recentReadingSessions.map((row) => ({
        key: row.trackedDay.toISOString().slice(0, 10),
        seconds: row.durationSeconds,
      })),
    },
  };
}
