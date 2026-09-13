import type { PrismaService } from '../prisma/prisma.service';
import { compareByEngagementDesc } from '../shared/engagement-date';
import type { LibraryItemRecord } from './types';

const HOME_ANNOTATION_LIMIT = 3;

export async function loadRecentAnnotations(options: {
  prisma: PrismaService;
  userId: string;
  libraryItems: LibraryItemRecord[];
}) {
  const { prisma, userId, libraryItems } = options;
  const recentBooks = selectRecentBooks(libraryItems);
  if (recentBooks.length === 0) return [];

  const annotatedBooks = await prisma.libraryItem.findMany({
    where: {
      userId,
      isArchived: false,
      id: { in: recentBooks.map((item) => item.id) },
    },
    select: {
      id: true,
      annotations: {
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          createdAt: true,
          excerpt: true,
          highlightColor: true,
          id: true,
          note: true,
        },
      },
    },
  });
  const annotationsByBook = new Map(
    annotatedBooks.map((item) => [item.id, item.annotations[0]]),
  );

  return recentBooks.flatMap((item) => {
    const annotation = annotationsByBook.get(item.id);
    if (!annotation) return [];

    return [
      {
        bookTitle: item.book.title,
        colorLabel: annotation.highlightColor ?? 'Archival Yellow',
        createdAt: annotation.createdAt.toISOString(),
        excerpt: annotation.excerpt,
        id: annotation.id,
        note: annotation.note,
      },
    ];
  });
}

function selectRecentBooks(libraryItems: LibraryItemRecord[]) {
  // Count first so books without highlights do not consume a slot, then
  // fetch excerpt text only for the three most recently engaged books.
  return libraryItems
    .filter((item) => item._count.annotations > 0)
    .sort(
      (left, right) =>
        compareByEngagementDesc(left, right) || left.id.localeCompare(right.id),
    )
    .slice(0, HOME_ANNOTATION_LIMIT);
}
