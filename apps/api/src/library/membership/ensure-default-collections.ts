import type { Prisma } from '@prisma/client';
import { resolveUniqueCollectionName } from '../../shared/collection-name';
import { buildCollectionSlugBase } from '../../shared/collection-slug';
import { DEFAULT_SMART_COLLECTIONS } from '../../shared/default-collections';
import { resolveUniqueSlug } from '../../shared/slugify';

// Upserts the three system smart shelves, keyed by per-user smartKey; names
// and slugs resolve uniqueness against non-smart namesakes
// (docs/specs/3-library/3.3-collections.md).
export async function ensureDefaultCollectionsTx(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  for (const collection of DEFAULT_SMART_COLLECTIONS) {
    const baseSlug = buildCollectionSlugBase({ name: collection.name });
    const slug = await resolveUniqueSlug(baseSlug, async (candidate) => {
      const conflict = await tx.collection.findUnique({
        where: { userId_slug: { userId, slug: candidate } },
        select: { id: true, smartKey: true },
      });
      return conflict !== null && conflict.smartKey !== collection.smartKey;
    });
    const name = await resolveUniqueCollectionName(
      collection.name,
      async (candidate) => {
        const conflict = await tx.collection.findUnique({
          where: { userId_name: { userId, name: candidate } },
          select: { smartKey: true },
        });
        return conflict !== null && conflict.smartKey !== collection.smartKey;
      },
    );

    await tx.collection.upsert({
      where: {
        userId_smartKey: {
          userId,
          smartKey: collection.smartKey,
        },
      },
      update: {
        description: collection.description,
        kind: 'SMART',
        name,
        sortOrder: collection.sortOrder,
      },
      create: {
        userId,
        smartKey: collection.smartKey,
        description: collection.description,
        kind: 'SMART',
        name,
        slug,
        sortOrder: collection.sortOrder,
      },
    });
  }
}
