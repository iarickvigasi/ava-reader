import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { ownedLibraryItemWhere } from './library-item-access';
import { syncOfflineBooksMembership } from '../membership/offline-collection-membership';

// Sets the per-user "keep this book available offline" intent. Synced across
// devices: a new device reads this on its next library load and the cache
// primer downloads the content (see specs/12-offline-save-sync). Idempotent;
// accepts either a libraryItemId or a slug like the read endpoints.
export async function setOfflineRequested(options: {
  prisma: PrismaService;
  ref: string;
  requested: boolean;
  userId: string;
}) {
  const item = await options.prisma.libraryItem.findFirst({
    where: ownedLibraryItemWhere(options.userId, options.ref),
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
