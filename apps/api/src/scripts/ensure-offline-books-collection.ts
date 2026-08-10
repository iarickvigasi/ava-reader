import { PrismaClient } from '@prisma/client';
import { resolveUniqueCollectionName } from '../shared/collection-name';
import { buildCollectionSlugBase } from '../shared/collection-slug';
import {
  DEFAULT_SMART_COLLECTIONS,
  OFFLINE_BOOKS_SMART_KEY,
} from '../shared/default-collections';
import { resolveUniqueSlug } from '../shared/slugify';

type CollectionDefinition = (typeof DEFAULT_SMART_COLLECTIONS)[number];

// Returns the user's Offline Books collection, creating it when absent. Name and
// slug resolve the same way the import path resolves them, so a user who already
// owns a collection called "Offline Books" doesn't collide with it.
export async function ensureOfflineBooksCollection(
  prisma: PrismaClient,
  userId: string,
  definition: CollectionDefinition,
) {
  const existing = await prisma.collection.findUnique({
    where: { userId_smartKey: { userId, smartKey: OFFLINE_BOOKS_SMART_KEY } },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const isTakenBy = async (where: { name: string } | { slug: string }) => {
    const conflict = await prisma.collection.findFirst({
      where: { userId, ...where },
      select: { smartKey: true },
    });
    return conflict !== null && conflict.smartKey !== OFFLINE_BOOKS_SMART_KEY;
  };

  const name = await resolveUniqueCollectionName(definition.name, (candidate) =>
    isTakenBy({ name: candidate }),
  );
  const slug = await resolveUniqueSlug(
    buildCollectionSlugBase({ name: definition.name }),
    (candidate) => isTakenBy({ slug: candidate }),
  );

  const collection = await prisma.collection.create({
    data: {
      userId,
      smartKey: OFFLINE_BOOKS_SMART_KEY,
      description: definition.description,
      kind: 'SMART',
      name,
      slug,
      sortOrder: definition.sortOrder,
    },
    select: { id: true },
  });

  return { id: collection.id, created: true };
}
