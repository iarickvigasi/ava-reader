import { Prisma } from '@prisma/client';
import { readMembershipResult } from './read-membership-result';
import type { MembershipUpdateOptions } from './types';
import { validateMembershipAccess } from './validate-membership-access';
import { validateMembershipChanges } from './validate-membership-changes';

const MAX_SERIALIZATION_RETRIES = 2;

// One transaction owns validation, the delta, and the snapshot returned to the
// offline bucket. Replays add existing rows / remove missing rows harmlessly.
export async function updateCollectionMembership(
  options: MembershipUpdateOptions,
) {
  const { addCollectionIds, removeCollectionIds } = validateMembershipChanges(
    options.input,
  );
  const collectionIds = [...addCollectionIds, ...removeCollectionIds];
  const { libraryItemId, userId } = options;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await options.prisma.$transaction(
        async (tx) => {
          const scope = { collectionIds, libraryItemId, tx, userId };
          await validateMembershipAccess(scope);
          if (addCollectionIds.length) {
            await tx.collectionItem.createMany({
              data: addCollectionIds.map((collectionId) => ({
                collectionId,
                libraryItemId,
              })),
              skipDuplicates: true,
            });
          }
          if (removeCollectionIds.length) {
            await tx.collectionItem.deleteMany({
              where: {
                libraryItemId,
                collectionId: { in: removeCollectionIds },
              },
            });
          }
          return readMembershipResult(scope);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        attempt < MAX_SERIALIZATION_RETRIES &&
        (error as { code?: string })?.code === 'P2034'
      ) {
        continue;
      }
      throw error;
    }
  }
}
