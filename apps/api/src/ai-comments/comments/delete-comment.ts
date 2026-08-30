import type { PrismaService } from '../../prisma/prisma.service';

export async function deleteAiComment(input: {
  id: string;
  libraryItemId: string;
  prisma: PrismaService;
  userId: string;
}): Promise<void> {
  // deleteMany silently no-ops when the row is missing or owned by another
  // user — matches the annotations contract so a replayed delete from a
  // queued mutation can't surface a spurious 404 to the client.
  await input.prisma.aiComment.deleteMany({
    where: {
      id: input.id,
      userId: input.userId,
      libraryItemId: input.libraryItemId,
    },
  });
}
