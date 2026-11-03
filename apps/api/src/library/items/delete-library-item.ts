import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

// Delete only this user's library copy; shared catalog/source books remain.
export async function deleteLibraryItem(
  prisma: PrismaService,
  userId: string,
  id: string,
) {
  return prisma.$transaction(async (tx) => {
    // Serialize deletion with checkpoints so access and the deletion receipt agree.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`,
    );
    const item = await tx.libraryItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!item) {
      if (await tx.deletedLibraryItem.findFirst({ where: { id, userId } })) {
        return { libraryItemId: id, state: 'deleted' as const };
      }
      throw new NotFoundException('The requested library item was not found.');
    }
    await tx.deletedLibraryItem.upsert({
      where: { id },
      create: { id, userId },
      update: {},
    });
    await tx.libraryItem.deleteMany({ where: { id, userId } });
    return { libraryItemId: id, state: 'deleted' as const };
  });
}
