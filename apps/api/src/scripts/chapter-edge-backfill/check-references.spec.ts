import type { PrismaClient } from '@prisma/client';
import { checkReferences } from './check-references';

it('blocks offline downloads, active processing, removed locators, and translations', async () => {
  const readProgress = jest
    .fn()
    .mockResolvedValue([{ currentLocator: '{"chapterId":"removed"}' }]);
  const prisma = {
    libraryItem: { count: jest.fn().mockResolvedValue(1) },
    bookProcessingRun: { count: jest.fn().mockResolvedValue(1) },
    readingProgress: { findMany: readProgress },
    annotation: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ locator: '{"start":{"chapterId":"removed"}}' }]),
    },
    aiComment: { findMany: jest.fn().mockResolvedValue([]) },
    sentenceTranslation: { count: jest.fn().mockResolvedValue(1) },
  } as unknown as PrismaClient;
  expect(
    await checkReferences(prisma, 'book', new Set(['removed'])),
  ).toHaveLength(5);
  expect(readProgress).toHaveBeenCalledWith({
    where: { libraryItem: { bookId: 'book' } },
    select: { currentLocator: true },
  });
});
