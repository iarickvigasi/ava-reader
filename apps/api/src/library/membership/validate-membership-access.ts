import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export async function validateMembershipAccess(options: {
  collectionIds: string[];
  libraryItemId: string;
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  const { collectionIds, libraryItemId, tx, userId } = options;
  const item = await tx.libraryItem.findFirst({
    where: { id: libraryItemId, userId, isArchived: false },
    select: { id: true },
  });
  if (!item) {
    throw new NotFoundException({
      code: 'bookNotFound',
      message: 'Book not found in library.',
    });
  }
  const collections = await tx.collection.findMany({
    where: { id: { in: collectionIds }, userId },
    select: { id: true, kind: true },
  });
  if (collections.length !== collectionIds.length) {
    throw new NotFoundException({
      code: 'collectionNotFound',
      message: 'Collection not found.',
    });
  }
  if (collections.some((collection) => collection.kind === 'SMART')) {
    throw new ForbiddenException({
      code: 'smartCollectionReadOnly',
      message: 'Smart collection membership cannot be edited.',
    });
  }
}
