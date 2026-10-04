import type { PrismaClient } from '@prisma/client';
import { locatorIsAffected } from './locator-is-affected';

export async function checkReferences(
  prisma: PrismaClient,
  bookId: string,
  removed: Set<string>,
) {
  const libraryItem = { bookId };
  const [offline, runs, progress, annotations, comments, translations] =
    await Promise.all([
      prisma.libraryItem.count({ where: { bookId, offlineRequested: true } }),
      prisma.bookProcessingRun.count({
        where: { bookId, status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      prisma.readingProgress.findMany({
        where: { libraryItem },
        select: { currentLocator: true },
      }),
      prisma.annotation.findMany({
        where: { libraryItem },
        select: { locator: true },
      }),
      prisma.aiComment.findMany({
        where: { libraryItem },
        select: { locator: true },
      }),
      prisma.sentenceTranslation.count({
        where: {
          chapterId: { in: [...removed] },
          bookTranslation: { libraryItem },
        },
      }),
    ]);
  const blockers: string[] = [];
  if (offline)
    blockers.push(
      'Book has offline download intent; content-cache migration required',
    );
  if (runs)
    blockers.push(
      'Book has pending/running processing; pause and drain workers',
    );
  if (progress.some((r) => locatorIsAffected(r.currentLocator, removed)))
    blockers.push('Saved reading position targets a removed chapter');
  if (
    [...annotations, ...comments].some((r) =>
      locatorIsAffected(r.locator, removed),
    )
  )
    blockers.push('Annotation or AI comment targets a removed chapter');
  if (translations) blockers.push('Translations target removed chapters');
  return blockers;
}
