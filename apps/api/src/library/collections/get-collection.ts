import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { collectionDetailsInclude } from './collection-details-include';
import { serializeCollection } from './serialize-collection';

// GET /library/collections/:ref — reads by collection id or slug.
export async function getCollection(options: {
  prisma: PrismaService;
  ref: string;
  userId: string;
}) {
  const collection = await options.prisma.collection.findFirst({
    where: {
      userId: options.userId,
      OR: [{ id: options.ref }, { slug: options.ref }],
    },
    include: collectionDetailsInclude,
  });

  if (!collection) {
    throw new NotFoundException('Collection not found.');
  }

  return {
    collection: serializeCollection(collection),
  };
}
