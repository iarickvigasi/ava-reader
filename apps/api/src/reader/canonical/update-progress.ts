import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OwnedLibraryItem } from '../library-item-access';
import type { ReaderLocator } from '../reader-types';
import {
  assertCanonicalContentAuthority,
  canonicalContentAuthority,
} from './content-authority';
import { createProgressSummary } from '../progress/progress-summary';
import { canonicalProgressMetrics } from './positions';
import type { AcceptedReader } from './load';
import type { ReaderCapability } from './semantic';
export async function updateCanonicalProgress(
  prisma: PrismaService,
  item: OwnedLibraryItem,
  accepted: AcceptedReader,
  capability: ReaderCapability,
  locator: ReaderLocator,
  readAt?: string,
) {
  const metrics = canonicalProgressMetrics(
    accepted.readerPackage.book,
    locator,
  );
  const when =
    readAt && Number.isFinite(Date.parse(readAt))
      ? new Date(readAt)
      : new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${item.id}, 0))`,
    );
    await assertCanonicalContentAuthority(
      tx,
      item.userId,
      item.id,
      canonicalContentAuthority(accepted),
      capability,
    );
    const stored = await tx.readingProgress.findUnique({
      where: { libraryItemId: item.id },
    });
    if (stored?.lastReadAt && when < stored.lastReadAt)
      return createProgressSummary(stored);
    const data = {
      ...metrics,
      currentLocator: JSON.stringify(locator),
      lastReadAt: when,
    };
    const progress = await tx.readingProgress.upsert({
      where: { libraryItemId: item.id },
      create: { libraryItemId: item.id, userId: item.userId, ...data },
      update: data,
    });
    await tx.libraryItem.update({
      where: { id: item.id },
      data: { lastOpenedAt: new Date() },
    });
    await assertCanonicalContentAuthority(
      tx,
      item.userId,
      item.id,
      canonicalContentAuthority(accepted),
      capability,
    );
    return createProgressSummary(progress);
  });
}
