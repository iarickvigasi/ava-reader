import type { PrismaService } from '../../prisma/prisma.service';
import type { AiCommentListItem } from '../ai-comment-types';
import { parseLocator } from './parse-locator';

// Returns every persisted AI comment the user has created for the item,
// newest first. Locator strings are parsed to JSON so the client can
// re-anchor them without an extra parse step; malformed locators come back
// as null.
export async function listAiComments(input: {
  libraryItemId: string;
  prisma: PrismaService;
  userId: string;
}): Promise<AiCommentListItem[]> {
  const rows = await input.prisma.aiComment.findMany({
    where: { userId: input.userId, libraryItemId: input.libraryItemId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      sourceText: true,
      body: true,
      targetLang: true,
      locator: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    locator: parseLocator(row.locator),
  }));
}
