import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { syncOfflineBooksMembership } from '../membership/offline-collection-membership';

// Sets the per-user "keep this book available offline" intent. Synced across
// devices: a new device reads this on its next library load and the cache
// primer downloads the content (see specs/4-offline/4.2-save-sync). Idempotent;
// id-only — by the time the switch is reachable the client holds the id
// from a library payload (see specs/3-library/3.5-library-payloads.md §7).
export async function setOfflineRequested(options: {
  libraryItemId: string;
  prisma: PrismaService;
  requested: boolean;
  userId: string;
}) {
  const item = await options.prisma.libraryItem.findFirst({
    where: {
      id: options.libraryItemId,
      isArchived: false,
      userId: options.userId,
    },
    select: { id: true },
  });
  if (!item) {
    throw new NotFoundException('Book not found in library.');
  }
  // The flag and the Offline Books membership it drives move together, so a
  // partial write can't leave the shelf disagreeing with the flag.
  const updated = await options.prisma.$transaction(async (tx) => {
    const row = await tx.libraryItem.update({
      where: { id: item.id },
      data: { offlineRequested: options.requested },
      select: { id: true, slug: true, offlineRequested: true },
    });
    await syncOfflineBooksMembership(tx, {
      libraryItemId: row.id,
      requested: options.requested,
      userId: options.userId,
    });
    return row;
  });
  return {
    libraryItemId: updated.id,
    offlineRequested: updated.offlineRequested,
    slug: updated.slug,
  };
}
