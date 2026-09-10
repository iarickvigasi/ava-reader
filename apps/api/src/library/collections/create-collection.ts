import type { PrismaService } from '../../prisma/prisma.service';
import { buildCollectionSlugBase } from '../../shared/collection-slug';
import { resolveUniqueSlug } from '../../shared/slugify';
import { validateCollectionInput } from './collection-input';
import { collectionWrite, duplicateCollectionError } from './collection-write';

export async function createCollection(options: {
  input: { name?: unknown; description?: unknown };
  prisma: PrismaService;
  userId: string;
}) {
  const { name, description } = validateCollectionInput(options.input);
  return collectionWrite(options.prisma, async (tx) => {
    const duplicate = await tx.collection.findFirst({
      where: {
        userId: options.userId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw duplicateCollectionError();
    const slug = await resolveUniqueSlug(
      buildCollectionSlugBase({ name }),
      async (candidate) => {
        return (
          (await tx.collection.findUnique({
            where: { userId_slug: { userId: options.userId, slug: candidate } },
            select: { id: true },
          })) !== null
        );
      },
    );
    const collection = await tx.collection.create({
      data: { userId: options.userId, name, description, slug, kind: 'CUSTOM' },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        kind: true,
        smartKey: true,
      },
    });
    return {
      collection: { ...collection, books: [], itemCount: 0, unreadCount: 0 },
    };
  });
}
