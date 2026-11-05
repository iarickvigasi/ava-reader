import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { privateBookAccess } from '../../shared/private-book-access';

export async function assertCheckpointAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  libraryItemId: string,
  closed: boolean,
) {
  const item = await tx.libraryItem.findFirst({
    where: { id: libraryItemId, userId, book: privateBookAccess(userId) },
    select: { id: true },
  });
  if (item) return;
  if (
    closed &&
    (await tx.deletedLibraryItem.findFirst({
      where: { id: libraryItemId, userId },
    }))
  )
    return;
  throw new NotFoundException('The requested library item was not found.');
}
