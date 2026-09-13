import type { PrismaService } from '../prisma/prisma.service';

export function loadHomeCollections(prisma: PrismaService, userId: string) {
  return prisma.collection.findMany({
    where: { userId },
    include: {
      items: {
        include: { libraryItem: { include: { progress: true } } },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}
