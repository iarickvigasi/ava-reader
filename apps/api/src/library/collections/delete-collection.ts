import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

// DELETE /library/collections/:id
// (docs/specs/3-library/3.3-collections.md §4).
export async function deleteCollection(options: {
  collectionId: string;
  prisma: PrismaService;
  userId: string;
}) {
  const collection = await options.prisma.collection.findFirst({
    where: {
      id: options.collectionId,
      userId: options.userId,
    },
    select: { id: true, kind: true },
  });

  if (!collection) {
    throw new NotFoundException('Collection not found.');
  }

  // System-owned shelves are recreated on the next import, so deleting one
  // only makes it flicker out and back. Blocked here as well as in the UI.
  if (collection.kind === 'SMART') {
    throw new ForbiddenException('Smart collections cannot be deleted.');
  }

  await options.prisma.collection.delete({ where: { id: collection.id } });

  return {
    collectionId: options.collectionId,
    state: 'deleted' as const,
  };
}
