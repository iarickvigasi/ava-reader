import type { Prisma } from '@prisma/client';
import { collectionDetailsInclude } from '../collections/collection-details-include';
import { serializeCollection } from '../collections/serialize-collection';
import { sortAndSerializeCollections } from '../items/serialize-item-collections';

export async function readMembershipResult(options: {
  collectionIds: string[];
  libraryItemId: string;
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  const { collectionIds, libraryItemId, tx, userId } = options;
  const membership = await tx.collectionItem.findMany({
    where: { libraryItemId, collection: { userId } },
    select: {
      collection: {
        select: {
          id: true,
          kind: true,
          name: true,
          smartKey: true,
          sortOrder: true,
        },
      },
    },
  });
  const affected = await tx.collection.findMany({
    where: { id: { in: collectionIds }, userId },
    include: collectionDetailsInclude,
  });
  const byId = new Map(
    affected.map((collection) => [collection.id, collection]),
  );
  return {
    libraryItemId,
    collections: sortAndSerializeCollections(membership),
    affectedCollections: collectionIds.map((id) =>
      serializeCollection(byId.get(id)!),
    ),
  };
}
