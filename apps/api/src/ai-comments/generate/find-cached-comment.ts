import type { PrismaService } from '../../prisma/prisma.service';

// Per-user cache: identical selection + tool + targetLang + model +
// selection context means we can skip the model call entirely.
export function findCachedAiComment(input: {
  prisma: PrismaService;
  sourceHash: string;
  userId: string;
}) {
  return input.prisma.aiComment.findUnique({
    where: {
      userId_sourceHash: {
        userId: input.userId,
        sourceHash: input.sourceHash,
      },
    },
  });
}
