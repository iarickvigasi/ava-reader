import type { PrismaService } from '../prisma/prisma.service';
import { buildMasteryHistoryPage } from './build-mastery-history-page';
import { loadMasteryHistorySnapshot } from './load-mastery-history-snapshot';
import { loadZonedReading } from './load-zoned-reading';
import { masteryHistoryWindow } from './mastery-history-window';

export async function loadMasteryHistory(
  prisma: PrismaService,
  userId: string,
  before: string,
  timeZone?: string,
) {
  const window = masteryHistoryWindow(before);
  if (timeZone !== undefined)
    return loadZonedReading(prisma, userId, timeZone, before);
  const snapshot = await loadMasteryHistorySnapshot(prisma, userId, window);
  return buildMasteryHistoryPage(window, snapshot);
}
