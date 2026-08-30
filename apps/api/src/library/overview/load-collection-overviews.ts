import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type LibraryItemLite = Prisma.LibraryItemGetPayload<{
  select: {
    id: true;
    isArchived: true;
    addedAt: true;
    lastOpenedAt: true;
    progress: {
      select: { completionPercent: true; lastReadAt: true };
    };
  };
}>;

// Phase 1 of GET /library: collections and a lightweight view of every item —
// enough to compute counts and the engagement sort, but without any book
// metadata or cover bytes. Touching cover bytes here is the historical hot
// path that made library loads slow.
export function loadCollectionOverviews(prisma: PrismaService, userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    select: {
      description: true,
      id: true,
      kind: true,
      name: true,
      slug: true,
      smartKey: true,
      sortOrder: true,
      items: {
        select: {
          libraryItem: {
            select: {
              addedAt: true,
              id: true,
              isArchived: true,
              lastOpenedAt: true,
              progress: {
                select: { completionPercent: true, lastReadAt: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}
