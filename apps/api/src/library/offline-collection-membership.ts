import { Prisma } from '@prisma/client';
import { OFFLINE_BOOKS_SMART_KEY } from '../shared/default-collections';

type TransactionClient = Prisma.TransactionClient;

// Keeps the Offline Books shelf in step with the LibraryItem.offlineRequested
// flag it mirrors, in the same transaction as the flag itself, so the two can
// never disagree. See docs/specs/17-offline-books-collection.md.
//
// A user whose collection doesn't exist yet — one who has never imported a book
// since the shelf shipped, and hasn't been backfilled — gets no membership row.
// The backfill script and their next import both create the collection, and the
// derived client view reads offlineRequested directly, so nothing is lost.
export async function syncOfflineBooksMembership(
  tx: TransactionClient,
  input: {
    libraryItemId: string;
    requested: boolean;
    userId: string;
  },
) {
  const collection = await tx.collection.findUnique({
    where: {
      userId_smartKey: {
        userId: input.userId,
        smartKey: OFFLINE_BOOKS_SMART_KEY,
      },
    },
    select: { id: true },
  });

  if (!collection) {
    return;
  }

  if (!input.requested) {
    await tx.collectionItem.deleteMany({
      where: {
        collectionId: collection.id,
        libraryItemId: input.libraryItemId,
      },
    });
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
