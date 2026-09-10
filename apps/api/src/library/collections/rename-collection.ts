import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { validateCollectionInput } from './collection-input';
import { collectionWrite, duplicateCollectionError } from './collection-write';

// PATCH /library/collections/:id
// (docs/specs/3-library/3.3-collections.md §3).
export async function renameCollection(options: {
  collectionId: string;
  input: {
    description?: null | string;
    name?: string;
  };
  prisma: PrismaService;
  userId: string;
}) {
  const normalized = validateCollectionInput(options.input);
  const name = normalized.name;
  return collectionWrite(options.prisma, async (tx) => {
    const collection = await tx.collection.findFirst({
      where: {
        id: options.collectionId,
        userId: options.userId,
      },
      select: {
        description: true,
        id: true,
        kind: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }

    if (collection.kind === 'SMART') {
      throw new ForbiddenException('Smart collections cannot be renamed.');
    }

    const description =
      options.input.description === undefined
        ? collection.description
        : normalized.description;

    const duplicate = await tx.collection.findFirst({
      where: {
        userId: options.userId,
        id: { not: collection.id },
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== collection.id)
      throw duplicateCollectionError();

    const renamed = await tx.collection.update({
      where: {
        id: collection.id,
      },
      data: {
        description,
        name,
      },
      select: {
        description: true,
        id: true,
        name: true,
      },
    });

    return {
      collectionId: renamed.id,
      description: renamed.description,
      name: renamed.name,
    };
  });
}
