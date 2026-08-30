import type { LibrarySource, Prisma } from '@prisma/client';
import { getSmartCollectionKey } from '../../shared/default-collections';

// Joins a library item to the smart shelf matching its source; idempotent,
// and a no-op for a user whose shelves don't exist yet.
export async function ensureCollectionMembershipTx(
  tx: Prisma.TransactionClient,
  input: {
    libraryItemId: string;
    source: LibrarySource;
    userId: string;
  },
) {
  const smartKey = getSmartCollectionKey(input.source);
  const collection = await tx.collection.findUnique({
    where: {
      userId_smartKey: {
        userId: input.userId,
        smartKey,
      },
    },
  });

  if (!collection) {
    return;
  }

  await tx.collectionItem.upsert({
    where: {
      collectionId_libraryItemId: {
        collectionId: collection.id,
        libraryItemId: input.libraryItemId,
      },
    },
    update: {},
    create: {
      collectionId: collection.id,
      libraryItemId: input.libraryItemId,
    },
  });
}
