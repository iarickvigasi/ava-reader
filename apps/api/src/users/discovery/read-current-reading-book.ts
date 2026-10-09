import type { PrismaService } from '../../prisma/prisma.service';

export async function readCurrentReadingBook(
  prisma: PrismaService,
  userId: string,
) {
  const progress = await prisma.readingProgress.findFirst({
    where: {
      userId,
      lastReadAt: { not: null },
      completionPercent: { lt: 100 },
      libraryItem: { isArchived: false, finishedAt: null },
    },
    orderBy: [{ lastReadAt: 'desc' }, { libraryItemId: 'asc' }],
    select: {
      libraryItemId: true,
      lastReadAt: true,
      libraryItem: {
        select: { book: { select: { title: true, authors: true } } },
      },
    },
  });
  return progress
    ? {
        libraryItemId: progress.libraryItemId,
        title: progress.libraryItem.book.title,
        authors: progress.libraryItem.book.authors,
        lastReadAt: progress.lastReadAt!.toISOString(),
      }
    : null;
}
