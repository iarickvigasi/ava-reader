import type { PrismaService } from '../prisma/prisma.service';

export function loadHomeLibraryItems(prisma: PrismaService, userId: string) {
  return prisma.libraryItem.findMany({
    where: { userId, isArchived: false },
    include: {
      _count: { select: { annotations: { where: { userId } } } },
      book: {
        include: {
          // Covers are served by URL; file progress indexes are not used here.
          coverBlob: { select: { mimeType: true } },
          files: { select: { format: true, isPrimary: true, kind: true } },
        },
      },
      progress: true,
    },
  });
}
