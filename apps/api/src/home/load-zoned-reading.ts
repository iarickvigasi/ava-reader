import type { PrismaService } from '../prisma/prisma.service';
import { buildZonedReadingSnapshot } from './build-zoned-reading-snapshot';
import { loadZonedReadingSnapshot } from './load-zoned-reading-snapshot';
import { readingWindow } from './reading-window';

export async function loadZonedReading(
  prisma: PrismaService,
  userId: string,
  timeZone: string,
  before?: string,
) {
  const window = readingWindow(timeZone, before);
  const snapshot = await loadZonedReadingSnapshot(prisma, userId, {
    window,
    before,
  });
  return buildZonedReadingSnapshot(window, snapshot, timeZone);
}
