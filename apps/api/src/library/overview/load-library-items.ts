import { privateBookAccess } from '../../shared/private-book-access';
import type { Prisma } from '@prisma/client';

// All owned identities authorize pruning; archived rows never become visible cards.
export function loadLibraryItems(
  prisma: Prisma.TransactionClient,
  userId: string,
) {
  return prisma.libraryItem.findMany({
    where: { userId, book: privateBookAccess(userId) },
    select: {
      id: true,
      isArchived: true,
      addedAt: true,
      lastOpenedAt: true,
      finishedAt: true,
      progress: { select: { completionPercent: true, lastReadAt: true } },
    },
  });
}
