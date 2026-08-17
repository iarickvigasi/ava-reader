import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  findReadyDerivedReader,
  type OwnedLibraryItem,
} from '../library-item-access';
import type { ReaderProgressSummary } from '../reader-payload-types';
import type { ReaderLocator } from '../reader-types';
import { loadReadingProgressIndex } from './load-progress-index';
import { computeProgressMetricsFromIndex } from './progress-metrics';
import { createProgressSummary } from './progress-summary';

export async function updateReadingProgress(
  prisma: PrismaService,
  libraryItem: OwnedLibraryItem,
  libraryItemId: string,
  locator: ReaderLocator,
  // Client's reading timestamp (when the user was at this locator on their
  // device). Drives most-recent-reading-wins across devices. Optional for
  // back-compat — a missing/invalid readAt applies unconditionally, stamped
  // with server time.
  readAt?: string,
): Promise<ReaderProgressSummary> {
  const derivedReader = findReadyDerivedReader(libraryItem);

  if (!derivedReader) {
    throw new BadRequestException('The reader package is not ready yet.');
  }

  const parsedReadAt =
    readAt && !Number.isNaN(new Date(readAt).getTime())
      ? new Date(readAt)
      : null;
  const stored = libraryItem.progress;
  // Most-recent-reading wins: a client read strictly older than what we've
  // already stored loses, so we return the stored (newer) position unchanged
  // and let the client adopt it. Guards against a late offline sync rewinding
  // a position another device advanced. Not fully atomic against a same-book
  // write racing within the request window — acceptable for reading progress.
  if (
    parsedReadAt &&
    stored?.lastReadAt &&
    parsedReadAt.getTime() < stored.lastReadAt.getTime()
  ) {
    return createProgressSummary(stored);
  }

  const index = await loadReadingProgressIndex(prisma, derivedReader);
  const metrics = computeProgressMetricsFromIndex(index, locator);

  const progress = await prisma.readingProgress.update({
    where: {
      libraryItemId,
    },
    data: {
      chapterLabel: metrics.chapterLabel,
      completionPercent: metrics.completionPercent,
      currentLocator: JSON.stringify(locator),
      lastReadAt: parsedReadAt ?? new Date(),
    },
  });

  await prisma.libraryItem.update({
    where: {
      id: libraryItemId,
    },
    data: {
      lastOpenedAt: new Date(),
    },
  });

  return createProgressSummary(progress);
}
